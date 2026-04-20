import type { TimesheetPayrollInput } from "@/src/lib/payroll/from-timesheets";

type EntryLike = {
  date: Date;
  hoursWorked: number;
  overtime: number;
};

export function toTimesheetLikeInputsFromPayrollEntries(entries: EntryLike[]): TimesheetPayrollInput[] {
  return entries.map((entry) => {
    const dateIso = entry.date.toISOString().slice(0, 10);
    const regular = Math.max(0, Number(entry.hoursWorked ?? 0) - Number(entry.overtime ?? 0));
    const ot = Math.max(0, Number(entry.overtime ?? 0));
    return {
      weekStart: entry.date,
      hoursWorked: regular,
      overtimeHrs: ot,
      dailyBreakdown: [{ date: dateIso, regular, ot }],
    };
  });
}
