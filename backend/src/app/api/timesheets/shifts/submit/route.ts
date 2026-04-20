import { apiError } from "@/src/lib/api-error";
import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { isTimesheetDateOnOrAfterJoining } from "@/src/lib/timesheet-join-date";
import type { ShiftPattern } from "@prisma/client";

function parseDateOnly(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function shiftPatternFromName(name: string): ShiftPattern | null {
  const normalized = name.trim().toUpperCase();
  if (normalized === "MORNING") return "MORNING";
  if (normalized === "EVENING") return "EVENING";
  if (normalized === "NIGHT") return "NIGHT";
  return null;
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["SITE_SUPERVISOR", "HR_ADMIN"], "Only Site Supervisor or HR can submit shift timesheets");
    const body = (await req.json()) as { siteId?: string; shiftId?: string; date?: string };
    if (!body.siteId || !body.shiftId || !body.date) return apiError("siteId, shiftId and date are required", 400);
    const dateOnly = parseDateOnly(body.date);

    const submission = await prisma.shiftTimesheetSubmission.findFirst({
      where: {
        demoSessionId: session.demoSessionId,
        siteId: body.siteId,
        shiftId: body.shiftId,
        date: dateOnly,
        ...(session.role === "SITE_SUPERVISOR" ? { site: { supervisorUserId: session.userId } } : {}),
      },
      include: { lineItems: true },
    });
    if (!submission) return apiError("No draft exists for this shift/date", 404);
    if (submission.status === "APPROVED") return apiError("Approved shift timesheet cannot be edited", 409);
    const shift = await prisma.shift.findFirst({
      where: { id: body.shiftId, demoSessionId: session.demoSessionId },
      select: { name: true },
    });
    if (!shift) return apiError("Shift not found", 404);
    const shiftPattern = shiftPatternFromName(shift.name);

    const assigned = await prisma.employee.findMany({
      where: {
        demoSessionId: session.demoSessionId,
        status: { not: "EXITED" },
        siteAssignment: {
          siteId: body.siteId,
          ...(shiftPattern ? { shiftPattern } : {}),
        },
      },
      select: { id: true, contractStart: true },
    });
    const eligibleIds = assigned
      .filter((emp) => isTimesheetDateOnOrAfterJoining(body.date as string, emp.contractStart))
      .map((emp) => emp.id);
    const markedIds = new Set(submission.lineItems.map((line) => line.employeeId));
    const missing = eligibleIds.filter((id) => !markedIds.has(id));
    if (missing.length > 0) {
      return apiError("All assigned employees must be marked before submitting this shift", 400);
    }

    const updated = await prisma.shiftTimesheetSubmission.update({
      where: { id: submission.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });
    return Response.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to submit shift timesheet", 400);
  }
}
