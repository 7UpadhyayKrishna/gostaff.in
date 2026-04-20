import { apiError } from "@/src/lib/api-error";
import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { contractJoinDateIsoUtc, isTimesheetDateOnOrAfterJoining } from "@/src/lib/timesheet-join-date";
import type { AttendanceStatus, ShiftPattern } from "@prisma/client";

type LineInput = {
  employeeId?: string;
  attendanceStatus?: AttendanceStatus;
  hoursWorked?: number;
  overtime?: number;
  manualHoursOverride?: boolean;
};

function parseDateOnly(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function getShiftDurationHours(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const raw = endMins - startMins;
  const mins = raw > 0 ? raw : raw + 24 * 60;
  return mins / 60;
}

function shiftPatternFromName(name: string): ShiftPattern | null {
  const normalized = name.trim().toUpperCase();
  if (normalized === "MORNING") return "MORNING";
  if (normalized === "EVENING") return "EVENING";
  if (normalized === "NIGHT") return "NIGHT";
  return null;
}

export async function GET(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["SITE_SUPERVISOR", "HR_ADMIN", "OPS_DIRECTOR", "OWNER"]);
    const url = new URL(req.url);
    const siteId = url.searchParams.get("siteId");
    const shiftId = url.searchParams.get("shiftId");
    const date = url.searchParams.get("date");
    if (!siteId || !shiftId || !date) return apiError("siteId, shiftId and date are required", 400);

    const shift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        siteId,
        demoSessionId: session.demoSessionId,
        ...(session.role === "SITE_SUPERVISOR" ? { site: { supervisorUserId: session.userId } } : {}),
      },
      select: { id: true, name: true, startTime: true, endTime: true },
    });
    if (!shift) return apiError("Shift not found", 404);

    const submission = await prisma.shiftTimesheetSubmission.findFirst({
      where: { demoSessionId: session.demoSessionId, siteId, shiftId, date: parseDateOnly(date) },
      include: { lineItems: true },
    });
    const itemByEmployee = new Map((submission?.lineItems ?? []).map((line) => [line.employeeId, line]));
    const defaultHours = getShiftDurationHours(shift.startTime, shift.endTime);
    const shiftPattern = shiftPatternFromName(shift.name);
    const siteAssignmentWhere = {
      siteId,
      ...(shiftPattern ? { shiftPattern } : {}),
      ...(session.role === "SITE_SUPERVISOR" ? { site: { supervisorUserId: session.userId } } : {}),
    };

    const employees = await prisma.employee.findMany({
      where: {
        demoSessionId: session.demoSessionId,
        status: { not: "EXITED" },
        siteAssignment: siteAssignmentWhere,
      },
      select: { id: true, employeeId: true, fullName: true, contractStart: true },
      orderBy: { fullName: "asc" },
    });

    const lines = employees.map((emp) => {
      const existing = itemByEmployee.get(emp.id);
      const isEligible = isTimesheetDateOnOrAfterJoining(date, emp.contractStart);
      const joiningDate = contractJoinDateIsoUtc(emp.contractStart);
      return {
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        employeeName: emp.fullName,
        joiningDate,
        attendanceStatus: existing?.attendanceStatus ?? null,
        hoursWorked: existing?.hoursWorked ?? defaultHours,
        overtime: existing?.overtime ?? 0,
        manualHoursOverride: existing?.manualHoursOverride ?? false,
        isEligible,
      };
    });

    return Response.json({
      shift,
      submission: submission
        ? {
            id: submission.id,
            status: submission.status,
            submittedAt: submission.submittedAt,
            approvedAt: submission.approvedAt,
            rejectedAt: submission.rejectedAt,
            rejectionRemark: submission.rejectionRemark,
          }
        : null,
      lines,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch shift timesheet", 400);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["SITE_SUPERVISOR", "HR_ADMIN"], "Only Site Supervisor or HR can save shift timesheets");
    const body = (await req.json()) as { siteId?: string; shiftId?: string; date?: string; entries?: LineInput[] };
    if (!body.siteId || !body.shiftId || !body.date || !Array.isArray(body.entries)) {
      return apiError("siteId, shiftId, date and entries are required", 400);
    }
    const entries = body.entries;
    const date = parseDateOnly(body.date);
    const shift = await prisma.shift.findFirst({
      where: {
        id: body.shiftId,
        siteId: body.siteId,
        demoSessionId: session.demoSessionId,
        ...(session.role === "SITE_SUPERVISOR" ? { site: { supervisorUserId: session.userId } } : {}),
      },
      select: { id: true, name: true },
    });
    if (!shift) return apiError("Shift not found", 404);
    const shiftPattern = shiftPatternFromName(shift.name);

    const locked = await prisma.shiftTimesheetSubmission.findFirst({
      where: {
        demoSessionId: session.demoSessionId,
        siteId: body.siteId,
        shiftId: body.shiftId,
        date,
        status: "APPROVED",
      },
      select: { id: true },
    });
    if (locked) return apiError("Approved shift timesheet cannot be edited", 409);

    const employeeIds = entries.map((e) => e.employeeId).filter((id): id is string => Boolean(id));
    const employees = await prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
        demoSessionId: session.demoSessionId,
        status: { not: "EXITED" },
        siteAssignment: {
          siteId: body.siteId,
          ...(shiftPattern ? { shiftPattern } : {}),
        },
      },
      select: { id: true },
    });
    if (employees.length !== employeeIds.length) return apiError("Entries include invalid employees for this site", 400);

    const submission = await prisma.shiftTimesheetSubmission.upsert({
      where: {
        demoSessionId_siteId_shiftId_date: {
          demoSessionId: session.demoSessionId,
          siteId: body.siteId,
          shiftId: body.shiftId,
          date,
        },
      },
      update: { status: "DRAFT", rejectionRemark: null, rejectedAt: null },
      create: {
        demoSessionId: session.demoSessionId,
        siteId: body.siteId,
        shiftId: body.shiftId,
        date,
        status: "DRAFT",
      },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.shiftTimesheetLineItem.deleteMany({ where: { submissionId: submission.id } });
      for (const entry of entries) {
        if (!entry.employeeId || !entry.attendanceStatus) continue;
        const hoursWorked = entry.attendanceStatus === "ABSENT" ? 0 : Math.max(0, Math.min(24, Number(entry.hoursWorked ?? 0)));
        const overtime = entry.attendanceStatus === "ABSENT" ? 0 : Math.max(0, Math.min(24, Number(entry.overtime ?? 0)));
        await tx.shiftTimesheetLineItem.create({
          data: {
            submissionId: submission.id,
            employeeId: entry.employeeId,
            attendanceStatus: entry.attendanceStatus,
            hoursWorked,
            overtime,
            manualHoursOverride: Boolean(entry.manualHoursOverride),
          },
        });
      }
    });

    return Response.json({ ok: true, submissionId: submission.id });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to save shift timesheet", 400);
  }
}
