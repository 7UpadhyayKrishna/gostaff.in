import { prisma } from "@/src/lib/prisma";
import { computeMonthlyPayFromTimesheets } from "@/src/lib/payroll/from-timesheets";
import { toTimesheetLikeInputsFromPayrollEntries } from "@/src/lib/payroll/from-payroll-entries";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";
import { logPayrollRunAudit } from "@/src/lib/payroll-audit";

export async function GET() {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "OWNER"], "Only HR, Operation, or Owner can access payroll");
    const runs = await prisma.payrollRun.findMany({
      where: { demoSessionId: session.demoSessionId },
      select: {
        id: true,
        month: true,
        status: true,
        totalEmployees: true,
        totalGross: true,
        totalNet: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(runs);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch payroll runs", 400);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can create payroll runs");
    const body = (await req.json()) as { month?: string };
    const month = body.month ?? new Date().toISOString().slice(0, 7);
    const periodStart = new Date(`${month}-01T00:00:00.000Z`);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

    const [employees, approvedPayrollEntries] = await Promise.all([
      prisma.employee.findMany({
      where: { demoSessionId: session.demoSessionId, status: "ACTIVE", payrollConfig: { isNot: null } },
      include: {
        payrollConfig: true,
        siteAssignment: { include: { site: true } },
        timesheets: { where: { status: "LOCKED", period: month }, orderBy: { weekStart: "desc" } },
      },
      }),
      prisma.payrollEntry.findMany({
        where: {
          demoSessionId: session.demoSessionId,
          date: { gte: periodStart, lt: periodEnd },
          shiftSubmission: { status: "APPROVED" },
        },
        select: { employeeId: true, date: true, hoursWorked: true, overtime: true },
        orderBy: [{ employeeId: "asc" }, { date: "asc" }],
      }),
    ]);

    const payrollEntriesByEmployee = new Map<string, typeof approvedPayrollEntries>();
    for (const entry of approvedPayrollEntries) {
      const list = payrollEntriesByEmployee.get(entry.employeeId) ?? [];
      list.push(entry);
      payrollEntriesByEmployee.set(entry.employeeId, list);
    }

    const sites = await prisma.site.findMany({
      include: { _count: { select: { assignments: true } } },
    });
    const submissions = await prisma.siteTimesheetSubmission.findMany({
      where: { demoSessionId: session.demoSessionId, period: month },
      select: { siteId: true, status: true, submittedAt: true },
    });
    const subMap = new Map(submissions.map((s) => [s.siteId, s]));
    const siteStatus = sites.map((site) => ({
      siteId: site.id,
      siteName: site.name,
      assignedEmployees: site._count.assignments,
      status: subMap.get(site.id)?.status ?? "DRAFT",
      submittedAt: subMap.get(site.id)?.submittedAt ?? null,
    }));
    const blockedSites = siteStatus.filter((s) => s.status !== "LOCKED" && s.assignedEmployees > 0);

    const run = await prisma.payrollRun.upsert({
      where: { demoSessionId_month: { demoSessionId: session.demoSessionId, month } },
      update: {
        status: blockedSites.length ? "VALIDATING" : "COLLECTING",
        submissionStatusBySite: siteStatus as any,
        anomalySummary: { blockedSites: blockedSites.map((s) => s.siteName), blockedCount: blockedSites.length } as any,
      },
      create: {
        demoSessionId: session.demoSessionId,
        month,
        status: blockedSites.length ? "VALIDATING" : "COLLECTING",
        submissionStatusBySite: siteStatus as any,
        anomalySummary: { blockedSites: blockedSites.map((s) => s.siteName), blockedCount: blockedSites.length } as any,
      },
    });
    await logPayrollRunAudit({
      demoSessionId: session.demoSessionId,
      payrollRunId: run.id,
      actorUserId: session.userId,
      action: "CREATE_OR_RECALCULATE_RUN",
      fromStatus: null,
      toStatus: blockedSites.length ? "VALIDATING" : "COLLECTING",
      metadata: { month },
    });

    await prisma.payslip.deleteMany({ where: { payrollRunId: run.id } });

    let totalGross = 0;
    let totalNet = 0;
    let totalWeekdayOtHours = 0;
    let totalFridayOtHours = 0;
    let totalPublicHolidayHours = 0;
    let totalAbsentDays = 0;
    let totalDeductions = 0;

    const siteRollups = new Map<string, { siteName: string; employees: number; gross: number; net: number }>();
    for (const employee of employees) {
      const cfg = employee.payrollConfig!;
      const approvedEntries = payrollEntriesByEmployee.get(employee.id) ?? [];
      const sourceTimesheets =
        approvedEntries.length > 0
          ? toTimesheetLikeInputsFromPayrollEntries(approvedEntries)
          : employee.timesheets;
      const pay = computeMonthlyPayFromTimesheets(cfg, sourceTimesheets);

      totalGross += pay.grossSalary;
      totalNet += pay.netSalary;
      totalWeekdayOtHours += pay.weekdayOtHours;
      totalFridayOtHours += pay.fridayOtHours;
      totalPublicHolidayHours += pay.publicHolidayHours;
      totalAbsentDays += pay.absentDays;
      totalDeductions += pay.deductions;
      const siteName = employee.siteAssignment?.site?.name ?? "Unassigned";
      const current = siteRollups.get(siteName) ?? { siteName, employees: 0, gross: 0, net: 0 };
      current.employees += 1;
      current.gross += pay.grossSalary;
      current.net += pay.netSalary;
      siteRollups.set(siteName, current);

      await prisma.payslip.create({
        data: {
          payrollRunId: run.id,
          employeeId: employee.id,
          month,
          basicSalary: cfg.basicSalary,
          allowances: pay.allowances,
          grossSalary: pay.grossSalary,
          deductions: pay.deductions,
          netSalary: pay.netSalary,
          wpsStatus: "PENDING",
        },
      });
    }

    const updatedRun = await prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        totalEmployees: employees.length,
        totalGross,
        totalNet,
        status: blockedSites.length ? "VALIDATING" : "COLLECTING",
        anomalySummary: {
          blockedSites: blockedSites.map((s) => s.siteName),
          blockedCount: blockedSites.length,
          siteRollups: Array.from(siteRollups.values()),
          totals: {
            weekdayOtHours: Number(totalWeekdayOtHours.toFixed(2)),
            fridayOtHours: Number(totalFridayOtHours.toFixed(2)),
            publicHolidayHours: Number(totalPublicHolidayHours.toFixed(2)),
            absentDays: Number(totalAbsentDays.toFixed(2)),
            deductions: Number(totalDeductions.toFixed(2)),
          },
        } as any,
      },
      include: { payslips: true },
    });

    return Response.json(
      {
        ...updatedRun,
        blocker: blockedSites.length
          ? `Locked timesheets required for sites: ${blockedSites.map((s) => s.siteName).join(", ")}`
          : null,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to create payroll run", 400);
  }
}
