import type { TimesheetPayrollInput } from "@/src/lib/payroll/from-timesheets";

type EntryLike = {
  date: Date;
  hoursWorked: number;
  overtime: number;
};

export function toTimesheetLikeInputsFromPayrollEntries(entries: EntryLike[]): TimesheetPayrollInput[] {
  const byMonth = new Map<string, Map<string, { regular: number; ot: number }>>();

  for (const entry of entries) {
    const dateIso = entry.date.toISOString().slice(0, 10);
    const month = dateIso.slice(0, 7);
    const regular = Math.max(0, Number(entry.hoursWorked ?? 0) - Number(entry.overtime ?? 0));
    const ot = Math.max(0, Number(entry.overtime ?? 0));

    let monthMap = byMonth.get(month);
    if (!monthMap) {
      monthMap = new Map();
      byMonth.set(month, monthMap);
    }
    const existing = monthMap.get(dateIso) ?? { regular: 0, ot: 0 };
    monthMap.set(dateIso, {
      regular: existing.regular + regular,
      ot: existing.ot + ot,
    });
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, dayMap]) => {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);

      const dailyBreakdown: Array<{ date: string; regular: number; ot: number }> = [];
      let hoursWorked = 0;
      let overtimeHrs = 0;

      for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const iso = cursor.toISOString().slice(0, 10);
        const line = dayMap.get(iso) ?? { regular: 0, ot: 0 };
        dailyBreakdown.push({ date: iso, regular: line.regular, ot: line.ot });
        hoursWorked += line.regular;
        overtimeHrs += line.ot;
      }

      return {
        weekStart: start,
        hoursWorked,
        overtimeHrs,
        dailyBreakdown,
      };
    });
}
