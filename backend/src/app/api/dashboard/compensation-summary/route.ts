import { prisma } from "@/src/lib/prisma";
import { apiError } from "@/src/lib/api-error";
import {
  classifyTimesheetDayHours,
  computeBilledGross26DayFromTimesheets,
  computeMonthlyPayFromTimesheets,
} from "@/src/lib/payroll/from-timesheets";
import { toTimesheetLikeInputsFromPayrollEntries } from "@/src/lib/payroll/from-payroll-entries";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";

function isValidMonth(s: string) {
  return /^\d{4}-\d{2}$/.test(s);
}

function nextMonthStart(month: string) {
  const d = new Date(`${month}-01T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export async function GET(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "OWNER"], "Only HR, Ops, or Owner can view compensation accrual");

    const url = new URL(req.url);
    const asOfMonthParam = url.searchParams.get("asOfMonth");
    const asOfMonth = asOfMonthParam && isValidMonth(asOfMonthParam) ? asOfMonthParam : new Date().toISOString().slice(0, 7);
    const asOfMonthEndExclusive = nextMonthStart(asOfMonth);

    const employees = await prisma.employee.findMany({
      where: {
        demoSessionId: session.demoSessionId,
        status: "ACTIVE",
        payrollConfig: { isNot: null },
      },
      select: {
        id: true,
        fullName: true,
        employeeId: true,
        payrollConfig: true,
      },
      orderBy: { fullName: "asc" },
    });

    const employeeIds = employees.map((e) => e.id);
    if (employeeIds.length === 0) {
      return Response.json({ asOfMonth, employees: [] });
    }

    const timesheetSelect = {
      employeeId: true,
      period: true,
      dailyBreakdown: true,
      weekStart: true,
      hoursWorked: true,
      overtimeHrs: true,
    } as const;

    const [lockedTimesheets, unbilledTimesheets, approvedEntries, payslips] = await Promise.all([
      prisma.timesheet.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: "LOCKED",
          period: { lte: asOfMonth },
        },
        select: timesheetSelect,
        orderBy: [{ employeeId: "asc" }, { period: "asc" }, { weekStart: "asc" }],
      }),
      prisma.timesheet.findMany({
        where: {
          employeeId: { in: employeeIds },
          period: { lte: asOfMonth },
          status: { notIn: ["LOCKED", "REJECTED"] },
        },
        select: timesheetSelect,
        orderBy: [{ employeeId: "asc" }, { period: "asc" }, { weekStart: "asc" }],
      }),
      prisma.payrollEntry.findMany({
        where: {
          demoSessionId: session.demoSessionId,
          employeeId: { in: employeeIds },
          date: { lt: asOfMonthEndExclusive },
          shiftSubmission: { status: "APPROVED" },
        },
        select: {
          employeeId: true,
          date: true,
          hoursWorked: true,
          overtime: true,
        },
        orderBy: [{ employeeId: "asc" }, { date: "asc" }],
      }),
      prisma.payslip.findMany({
        where: {
          employeeId: { in: employeeIds },
          month: { lte: asOfMonth },
        },
        select: {
          employeeId: true,
          month: true,
        },
      }),
    ]);

    const byEmployeePeriod = new Map<string, Map<string, typeof lockedTimesheets>>();
    for (const ts of lockedTimesheets) {
      let periodMap = byEmployeePeriod.get(ts.employeeId);
      if (!periodMap) {
        periodMap = new Map();
        byEmployeePeriod.set(ts.employeeId, periodMap);
      }
      const list = periodMap.get(ts.period) ?? [];
      list.push(ts);
      periodMap.set(ts.period, list);
    }

    const approvedByEmployeePeriod = new Map<
      string,
      Map<string, Array<{ date: Date; hoursWorked: number; overtime: number }>>
    >();
    for (const row of approvedEntries) {
      const period = row.date.toISOString().slice(0, 7);
      if (period > asOfMonth) continue;
      let empMap = approvedByEmployeePeriod.get(row.employeeId);
      if (!empMap) {
        empMap = new Map();
        approvedByEmployeePeriod.set(row.employeeId, empMap);
      }
      const list = empMap.get(period) ?? [];
      list.push({ date: row.date, hoursWorked: row.hoursWorked, overtime: row.overtime });
      empMap.set(period, list);
    }

    const unbilledByEmployee = new Map<string, typeof unbilledTimesheets>();
    for (const ts of unbilledTimesheets) {
      const list = unbilledByEmployee.get(ts.employeeId) ?? [];
      list.push(ts);
      unbilledByEmployee.set(ts.employeeId, list);
    }
    const billedMonthsByEmployee = new Map<string, Set<string>>();
    for (const slip of payslips) {
      const months = billedMonthsByEmployee.get(slip.employeeId) ?? new Set<string>();
      months.add(slip.month);
      billedMonthsByEmployee.set(slip.employeeId, months);
    }

    const rows = employees.map((emp) => {
      const cfg = emp.payrollConfig!;
      const periodMap = byEmployeePeriod.get(emp.id);
      const approvedPeriodMap = approvedByEmployeePeriod.get(emp.id);
      const billedMonths = billedMonthsByEmployee.get(emp.id) ?? new Set<string>();
      const byMonth: Array<{
        period: string;
        grossSalary: number;
        netSalary: number;
        allowances: number;
        deductions: number;
        billedGross26: number;
      }> = [];

      let totalGross = 0;
      let totalNet = 0;
      let totalBilledGross26 = 0;
      let approvedUnbilledHours = 0;
      let approvedUnbilledGross26 = 0;

      const periods = new Set<string>();
      for (const period of periodMap?.keys() ?? []) {
        if (period <= asOfMonth) periods.add(period);
      }
      for (const period of approvedPeriodMap?.keys() ?? []) {
        if (period <= asOfMonth) periods.add(period);
      }

      for (const period of [...periods].sort()) {
        const approved = approvedPeriodMap?.get(period) ?? [];
        const hasGeneratedPayroll = billedMonths.has(period);
        const source = approved.length > 0 ? toTimesheetLikeInputsFromPayrollEntries(approved) : (periodMap?.get(period) ?? []);
        if (source.length === 0) continue;
        if (approved.length > 0 && !hasGeneratedPayroll) {
          approvedUnbilledHours += classifyTimesheetDayHours(source).totalWorkedHours;
          approvedUnbilledGross26 += computeBilledGross26DayFromTimesheets(cfg, source).billedGross;
          continue;
        }
        const pay = computeMonthlyPayFromTimesheets(cfg, source);
        const billed26 = computeBilledGross26DayFromTimesheets(cfg, source);
        byMonth.push({
          period,
          grossSalary: pay.grossSalary,
          netSalary: pay.netSalary,
          allowances: pay.allowances,
          deductions: pay.deductions,
          billedGross26: billed26.billedGross,
        });
        totalGross += pay.grossSalary;
        totalNet += pay.netSalary;
        totalBilledGross26 += billed26.billedGross;
      }

      const unbilledList = unbilledByEmployee.get(emp.id) ?? [];
      const baseUnbilledHours = classifyTimesheetDayHours(unbilledList).totalWorkedHours;
      const baseUnbilledGross26 =
        unbilledList.length > 0 ? computeBilledGross26DayFromTimesheets(cfg, unbilledList).billedGross : 0;
      const unbilledHours = baseUnbilledHours + approvedUnbilledHours;
      const unbilledGross26 = baseUnbilledGross26 + approvedUnbilledGross26;

      return {
        id: emp.id,
        fullName: emp.fullName,
        employeeId: emp.employeeId,
        basicSalary: cfg.basicSalary,
        housingAllowance: cfg.housingAllowance,
        transportAllowance: cfg.transportAllowance,
        byMonth,
        totalGross,
        totalNet,
        totalBilledGross26,
        unbilledHours,
        unbilledGross26,
      };
    });

    return Response.json({ asOfMonth, employees: rows });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch compensation summary", 400);
  }
}
