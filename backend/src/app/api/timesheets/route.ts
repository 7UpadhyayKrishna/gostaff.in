import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { isTimesheetWeekOnOrAfterJoining } from "@/src/lib/timesheet-join-date";
import { apiError } from "@/src/lib/api-error";

function toPeriod(date: Date) {
  return date.toISOString().slice(0, 7);
}

export async function GET() {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "SITE_SUPERVISOR", "OWNER"]);
    const timesheets = await prisma.timesheet.findMany({
      where: {
        employee: {
          demoSessionId: session.demoSessionId,
          ...(session.role === "SITE_SUPERVISOR"
            ? { siteAssignment: { site: { supervisorUserId: session.userId } } }
            : {}),
        },
      },
      include: { employee: true },
      orderBy: { weekStart: "desc" },
    });

    return Response.json(timesheets);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch timesheets", 400);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "SITE_SUPERVISOR"], "Only HR or Site Supervisor can create timesheets");
    const body = (await req.json()) as { employeeId: string; weekStart: string; hoursWorked: number; overtimeHrs?: number };

    const employee = await prisma.employee.findFirst({
      where: {
        id: body.employeeId,
        demoSessionId: session.demoSessionId,
        ...(session.role === "SITE_SUPERVISOR"
          ? { siteAssignment: { site: { supervisorUserId: session.userId } } }
          : {}),
      },
      select: { id: true, contractStart: true },
    });

    if (!employee) return apiError("Employee not found", 404);
    const employeeStatus = await prisma.employee.findUnique({
      where: { id: employee.id },
      select: { status: true },
    });
    if (employeeStatus?.status === "EXITED") {
      return apiError("Exited employees are archived and cannot have timesheets created.", 409);
    }

    const weekStart = new Date(body.weekStart);
    if (!isTimesheetWeekOnOrAfterJoining(weekStart, employee.contractStart)) {
      return apiError("Timesheet week cannot start before the employee’s date of joining.", 400);
    }
    const period = toPeriod(weekStart);
    const siteAssignment = await prisma.siteAssignment.findUnique({
      where: { employeeId: employee.id },
      select: { siteId: true },
    });

    if (session.role === "SITE_SUPERVISOR" && !siteAssignment?.siteId) {
      return apiError("Employee is not assigned to site", 400);
    }

    const lock = siteAssignment?.siteId
      ? await prisma.siteTimesheetSubmission.findFirst({
          where: {
            demoSessionId: session.demoSessionId,
            siteId: siteAssignment.siteId,
            period,
            status: "LOCKED",
          },
          select: { id: true },
        })
      : null;
    if (lock) return apiError("Timesheets for this site/period are locked", 409);

    const timesheet = await prisma.timesheet.create({
      data: {
        employeeId: employee.id,
        weekStart,
        hoursWorked: Number(body.hoursWorked),
        overtimeHrs: Number(body.overtimeHrs ?? 0),
        status: "SUBMITTED",
        submittedAt: new Date(),
        period,
        siteIdSnapshot: siteAssignment?.siteId ?? null,
      },
    });

    return Response.json(timesheet, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to create timesheet", 400);
  }
}
