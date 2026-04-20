/** Calendar YYYY-MM-DD in UTC, aligned with how week boundaries are computed in timesheet routes. */
export function contractJoinDateIsoUtc(contractStart: Date): string {
  return contractStart.toISOString().slice(0, 10);
}

export function isTimesheetDateOnOrAfterJoining(dateIso: string, contractStart: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;
  return dateIso >= contractJoinDateIsoUtc(contractStart);
}

/** Monday-based week (UTC); allowed if the week’s Sunday (UTC) is on or after joining date. */
export function isTimesheetWeekOnOrAfterJoining(weekStart: Date, contractStart: Date): boolean {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);
  return weekEndIso >= contractJoinDateIsoUtc(contractStart);
}

/** Month period `YYYY-MM`: timesheet expected only if the last calendar day of that month is on or after joining. */
export function isPeriodCoveringJoining(period: string, contractStart: Date): boolean {
  const parts = period.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  if (!y || !m || m < 1 || m > 12) return true;
  const last = new Date(Date.UTC(y, m, 0));
  const lastIso = last.toISOString().slice(0, 10);
  return lastIso >= contractJoinDateIsoUtc(contractStart);
}
