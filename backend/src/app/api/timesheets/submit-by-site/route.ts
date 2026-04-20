import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { isPeriodCoveringJoining } from "@/src/lib/timesheet-join-date";
import { apiError } from "@/src/lib/api-error";

type Body = { siteId?: string; period?: string };

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["SITE_SUPERVISOR"], "Only site supervisor can submit by site");
    const body = (await req.json()) as Body;
    if (!body.siteId || !body.period) return apiError("siteId and period are required", 400);
    const period = body.period;
    const siteId = body.siteId;

    const site = await prisma.site.findFirst({
      where: { id: siteId, supervisorUserId: session.userId },
      select: { id: true },
    });
    if (!site) return apiError("Site not found for supervisor", 404);

    const assignedEmployees = await prisma.employee.findMany({
      where: {
        demoSessionId: session.demoSessionId,
        siteAssignment: { siteId },
        status: "ACTIVE",
      },
      select: { id: true, fullName: true, contractStart: true },
    });
    if (assignedEmployees.length === 0) {
      return apiError("No active employees are assigned to this site", 400);
    }

    const inScope = assignedEmployees.filter((e) => isPeriodCoveringJoining(period, e.contractStart));
    if (inScope.length === 0) {
      return apiError("No employees in this period yet (all joining dates are after this month).", 400);
    }

    const employeeIds = inScope.map((e) => e.id);
    const periodTimesheets = await prisma.timesheet.findMany({
      where: {
        period,
        employeeId: { in: employeeIds },
      },
      select: { employeeId: true, dailyBreakdown: true },
    });
    const timesheetByEmployee = new Map(periodTimesheets.map((t) => [t.employeeId, t]));
    const missingEmployees = inScope
      .filter((employee) => {
        const row = timesheetByEmployee.get(employee.id);
        if (!row) return true;
        if (!Array.isArray(row.dailyBreakdown)) return true;
        return row.dailyBreakdown.length === 0;
      })
      .map((e) => e.fullName);
    if (missingEmployees.length > 0) {
      return Response.json(
        {
          error: `Daily timesheet missing for ${missingEmployees.length} employee(s): ${missingEmployees.slice(0, 5).join(", ")}`,
        },
        { status: 409 },
      );
    }

    await prisma.timesheet.updateMany({
      where: {
        period,
        status: { in: ["DRAFT", "SUBMITTED", "REJECTED"] },
        employee: {
          demoSessionId: session.demoSessionId,
          siteAssignment: { siteId },
        },
      },
      data: { status: "SUBMITTED", submittedAt: new Date(), siteIdSnapshot: siteId },
    });

    const submission = await prisma.siteTimesheetSubmission.upsert({
      where: { demoSessionId_siteId_period: { demoSessionId: session.demoSessionId, siteId, period } },
      update: { status: "SUBMITTED", submittedAt: new Date(), note: null },
      create: {
        demoSessionId: session.demoSessionId,
        siteId,
        period,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    return Response.json(submission);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to submit site timesheets", 400);
  }
}
