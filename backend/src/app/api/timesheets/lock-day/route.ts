import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { isTimesheetDateOnOrAfterJoining } from "@/src/lib/timesheet-join-date";
import { apiError } from "@/src/lib/api-error";

type DayLockNote = { dayLocks?: string[] };

function toPeriod(date: Date) {
  return date.toISOString().slice(0, 7);
}

function localIsoDateFromOffset(offsetMinutes: number) {
  const now = new Date();
  const localMs = now.getTime() - offsetMinutes * 60 * 1000;
  return new Date(localMs).toISOString().slice(0, 10);
}

function weekStartFromDateIso(dateIso: string) {
  const d = new Date(`${dateIso}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function dayHasCompleteEntry(d: unknown, dateIso: string): boolean {
  if (!d || typeof d !== "object") return false;
  const row = d as { date?: string; absent?: boolean; regular?: unknown; ot?: unknown };
  if (row.date !== dateIso) return false;
  if (row.absent === true) return true;
  const regular = Number(row.regular ?? 0);
  const ot = Number(row.ot ?? 0);
  return regular + ot > 0;
}

function parseLockNote(raw: string | null): DayLockNote {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as DayLockNote;
    if (Array.isArray(parsed.dayLocks)) return { dayLocks: parsed.dayLocks.filter((d) => typeof d === "string") };
    return {};
  } catch {
    return {};
  }
}

type Body = { siteId?: string; date?: string; dates?: string[]; timezoneOffsetMinutes?: number };

async function submitAndLockOneDay(args: {
  demoSessionId: string;
  supervisorUserId: string;
  siteId: string;
  dateIso: string;
}) {
  const site = await prisma.site.findFirst({
    where: { id: args.siteId, supervisorUserId: args.supervisorUserId },
    select: { id: true, name: true },
  });
  if (!site) return { ok: false, error: "Site not found for supervisor" };

  const weekStart = weekStartFromDateIso(args.dateIso);
  const period = toPeriod(new Date(`${args.dateIso}T00:00:00.000Z`));
  const employees = await prisma.employee.findMany({
    where: {
      demoSessionId: args.demoSessionId,
      status: "ACTIVE",
      siteAssignment: { siteId: args.siteId },
    },
    select: { id: true, fullName: true, contractStart: true },
  });
  if (employees.length === 0) return { ok: false, error: "No active employees assigned to site" };
  const employeeIds = employees.filter((e) => isTimesheetDateOnOrAfterJoining(args.dateIso, e.contractStart)).map((e) => e.id);
  if (employeeIds.length === 0) return { ok: false, error: "No employees with a joining date on or before selected date for this site." };

  const timesheets = await prisma.timesheet.findMany({
    where: { employeeId: { in: employeeIds }, weekStart, period },
    select: { id: true, employeeId: true, dailyBreakdown: true, status: true },
  });
  const byEmployee = new Map(timesheets.map((t) => [t.employeeId, t]));
  const missing = employees.filter((e) => {
    if (!isTimesheetDateOnOrAfterJoining(args.dateIso, e.contractStart)) return false;
    const ts = byEmployee.get(e.id);
    if (!ts || !Array.isArray(ts.dailyBreakdown)) return true;
    return !ts.dailyBreakdown.some((d) => dayHasCompleteEntry(d, args.dateIso));
  });
  if (missing.length > 0) {
    return { ok: false, error: `Daily entry missing for ${missing.length} employee(s): ${missing.slice(0, 5).map((e) => e.fullName).join(", ")}` };
  }

  const submission = await prisma.siteTimesheetSubmission.findUnique({
    where: { demoSessionId_siteId_period: { demoSessionId: args.demoSessionId, siteId: args.siteId, period } },
    select: { note: true, status: true },
  });
  if (submission?.status === "LOCKED") return { ok: false, error: "Site period is already locked by HR and is read-only." };
  const note = parseLockNote(submission?.note ?? null);
  const lockedDays = new Set(note.dayLocks ?? []);
  if (lockedDays.has(args.dateIso)) return { ok: true, alreadyLocked: true, date: args.dateIso, siteId: args.siteId, siteName: site.name };
  lockedDays.add(args.dateIso);

  await prisma.$transaction(async (tx) => {
    for (const ts of timesheets) {
      const lines = ((ts.dailyBreakdown as Array<Record<string, unknown>> | null) ?? []).map((line) => ({
        date: String(line.date),
        regular: Number(line.regular ?? 0),
        ot: Number(line.ot ?? 0),
      }));
      const totalRegular = lines.reduce((acc, line) => acc + line.regular, 0);
      const totalOt = lines.reduce((acc, line) => acc + line.ot, 0);
      await tx.timesheet.update({
        where: { id: ts.id },
        data: { status: "SUBMITTED", submittedAt: new Date(), hoursWorked: totalRegular, overtimeHrs: totalOt },
      });
    }
    await tx.siteTimesheetSubmission.upsert({
      where: { demoSessionId_siteId_period: { demoSessionId: args.demoSessionId, siteId: args.siteId, period } },
      update: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        note: JSON.stringify({ dayLocks: Array.from(lockedDays).sort() } satisfies DayLockNote),
      },
      create: {
        demoSessionId: args.demoSessionId,
        siteId: args.siteId,
        period,
        status: "SUBMITTED",
        submittedAt: new Date(),
        note: JSON.stringify({ dayLocks: [args.dateIso] } satisfies DayLockNote),
      },
    });
  });

  return { ok: true, siteId: args.siteId, siteName: site.name, date: args.dateIso };
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["SITE_SUPERVISOR"], "Only site supervisor can submit and lock today's entries");
    const body = (await req.json()) as Body;

    if (!body.siteId) return apiError("siteId is required", 400);
    const offset = Number(body.timezoneOffsetMinutes);
    if (!Number.isFinite(offset)) return apiError("timezoneOffsetMinutes is required", 400);
    const todayIso = localIsoDateFromOffset(offset);

    const requestedDates = Array.isArray(body.dates) && body.dates.length > 0 ? body.dates : body.date ? [body.date] : [];
    if (requestedDates.length === 0) return apiError("date or dates[] is required", 400);
    if (!requestedDates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))) return apiError("All dates must be YYYY-MM-DD", 400);
    if (requestedDates.some((d) => d > todayIso)) return apiError("Future dates cannot be submitted", 400);

    const results = [];
    for (const dateIso of requestedDates.sort()) {
      const result = await submitAndLockOneDay({
        demoSessionId: session.demoSessionId,
        supervisorUserId: session.userId,
        siteId: body.siteId,
        dateIso,
      });
      results.push({ date: dateIso, ...result });
    }
    if (results.length === 1) {
      const single = results[0];
      if (!single.ok) return apiError(single.error ?? "Unable to submit and lock selected day", 409);
      return Response.json(single);
    }
    const failed = results.filter((r) => !r.ok);
    return Response.json({
      ok: failed.length === 0,
      siteId: body.siteId,
      processed: results.length,
      successful: results.filter((r) => r.ok).length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to submit and lock today's timesheets", 400);
  }
}
