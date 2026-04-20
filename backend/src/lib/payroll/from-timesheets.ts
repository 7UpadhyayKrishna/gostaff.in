import type { PayrollConfig } from "@prisma/client";

export type DailyLine = {
  date?: string;
  regular?: number;
  ot?: number;
  publicHolidayHours?: number;
  isPublicHoliday?: boolean;
  publicHoliday?: boolean;
  holidayType?: string;
};

export type TimesheetPayrollInput = {
  dailyBreakdown: unknown;
  weekStart: Date;
  hoursWorked: number;
  overtimeHrs: number;
};

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isFriday(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 5;
}

export function normalizeDailyLines(timesheets: TimesheetPayrollInput[]) {
  const lines: DailyLine[] = [];
  for (const ts of timesheets) {
    if (Array.isArray(ts.dailyBreakdown) && ts.dailyBreakdown.length > 0) {
      for (const raw of ts.dailyBreakdown) {
        if (!raw || typeof raw !== "object") continue;
        lines.push(raw as DailyLine);
      }
      continue;
    }

    const start = new Date(ts.weekStart);
    const regularPerDay = ts.hoursWorked > 0 ? ts.hoursWorked / 6 : 0;
    const otPerDay = ts.overtimeHrs > 0 ? ts.overtimeHrs / 6 : 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      lines.push({
        date: iso,
        regular: i === 5 ? 0 : regularPerDay,
        ot: i === 5 ? otPerDay : 0,
      });
    }
  }
  return lines;
}

/** Bucket hours the same way as payroll (weekday vs Friday vs public holiday). */
export function classifyTimesheetDayHours(timesheets: TimesheetPayrollInput[]) {
  const dailyLines = normalizeDailyLines(timesheets);

  let weekdayRegular = 0;
  let weekdayOt = 0;
  let fridayHours = 0;
  let publicHolidayHours = 0;
  let expectedRegularHours = 0;

  for (const line of dailyLines) {
    const date = typeof line.date === "string" ? line.date : "";
    const regular = asNumber(line.regular);
    const ot = asNumber(line.ot);
    const markedPublicHoliday =
      line.isPublicHoliday === true || line.publicHoliday === true || String(line.holidayType ?? "").toUpperCase() === "PUBLIC";
    const linePublicHolidayHours = Math.max(0, asNumber(line.publicHolidayHours));
    const effectivePublicHolidayHours = markedPublicHoliday ? Math.max(linePublicHolidayHours, regular + ot) : linePublicHolidayHours;

    if (effectivePublicHolidayHours > 0 || markedPublicHoliday) {
      publicHolidayHours += effectivePublicHolidayHours;
      continue;
    }

    if (date && isFriday(date)) {
      fridayHours += regular + ot;
      continue;
    }

    weekdayRegular += regular;
    weekdayOt += ot;
    expectedRegularHours += 8;
  }

  const totalWorkedHours = weekdayRegular + weekdayOt + fridayHours + publicHolidayHours;

  return {
    weekdayRegular,
    weekdayOt,
    fridayHours,
    publicHolidayHours,
    expectedRegularHours,
    totalWorkedHours,
  };
}

export type MonthlyPayComputation = {
  basicSalary: number;
  allowances: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  weekdayOtHours: number;
  fridayOtHours: number;
  publicHolidayHours: number;
  absentDays: number;
};

/** Same rules as payroll run payslip generation for one employee and one calendar period. */
export function computeMonthlyPayFromTimesheets(
  cfg: PayrollConfig,
  timesheets: TimesheetPayrollInput[],
): MonthlyPayComputation {
  const baseHourly = cfg.basicSalary / 30 / 8;
  const c = classifyTimesheetDayHours(timesheets);

  const absentDays = Math.max(0, (c.expectedRegularHours - c.weekdayRegular) / 8);
  const weekdayOtPay = c.weekdayOt * baseHourly * 1.25;
  const fridayOtPay = c.fridayHours * baseHourly * 1.5;
  const publicHolidayPay = c.publicHolidayHours * baseHourly * 2;
  const absenceDeduction = (cfg.basicSalary / 30) * absentDays;
  const advanceRecovery = cfg.advanceRecovery ?? 0;
  const accommodationDeduction = cfg.accommodationDeduction ?? 0;
  const loanEmi = cfg.loanEmi ?? 0;

  const allowances = cfg.housingAllowance + cfg.transportAllowance + weekdayOtPay + fridayOtPay + publicHolidayPay;
  const grossSalary = cfg.basicSalary + allowances;
  const deductions = absenceDeduction + advanceRecovery + accommodationDeduction + loanEmi;
  const netSalary = grossSalary - deductions;

  return {
    basicSalary: cfg.basicSalary,
    allowances,
    grossSalary,
    deductions,
    netSalary,
    weekdayOtHours: c.weekdayOt,
    fridayOtHours: c.fridayHours,
    publicHolidayHours: c.publicHolidayHours,
    absentDays,
  };
}

/**
 * Client billing accrual: (basic + housing + transport) / 26 / 8 for base hourly; weekday OT at 1.25×;
 * Friday at 1.5×; public holiday at 2× (same 26-day base hourly).
 */
export function computeBilledGross26DayFromTimesheets(cfg: PayrollConfig, timesheets: TimesheetPayrollInput[]) {
  const monthlyPack = cfg.basicSalary + cfg.housingAllowance + cfg.transportAllowance;
  const hourly = monthlyPack / 26 / 8;
  const otRate = hourly * 1.25;
  const c = classifyTimesheetDayHours(timesheets);

  const billedGross =
    c.weekdayRegular * hourly +
    c.weekdayOt * otRate +
    c.fridayHours * hourly * 1.5 +
    c.publicHolidayHours * hourly * 2;

  return {
    billedGross,
    monthlyPack,
    dailyRate: monthlyPack / 26,
    hourly,
    otRate,
  };
}
