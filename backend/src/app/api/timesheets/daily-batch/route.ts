import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { isTimesheetDateOnOrAfterJoining } from "@/src/lib/timesheet-join-date";
import type { Prisma } from "@prisma/client";
import { apiError } from "@/src/lib/api-error";

type DayLockNote = { dayLocks?: string[] };
type Entry = { employeeId?: string; workedHours?: number; absent?: boolean };

type BreakdownDay = { date: string; regular: number; ot: number; absent?: boolean };

function toPeriod(date: Date) {
  return date.toISOString().slice(0, 7);
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

function localIsoDateFromOffset(offsetMinutes: number) {
  const now = new Date();
  const localMs = now.getTime() - offsetMinutes * 60 * 1000;
  return new Date(localMs).toISOString().slice(0, 10);
}

function weekStartFromDateIso(dateIso: string) {
  const d = new Date(`${dateIso}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["SITE_SUPERVISOR", "HR_ADMIN"], "Only site supervisors or HR can save daily timesheets");
    const body = (await req.json()) as {
      date?: string;
      timezoneOffsetMinutes?: number;
      entries?: Entry[];
    };

    if (!body.date || !Array.isArray(body.entries) || body.entries.length === 0) {
      return apiError("date and entries are required", 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return apiError("date must be YYYY-MM-DD", 400);

    const offset = Number(body.timezoneOffsetMinutes);
    if (!Number.isFinite(offset)) return apiError("timezoneOffsetMinutes is required", 400);
    if (body.date !== localIsoDateFromOffset(offset)) {
      return apiError("Only today's timesheet can be edited", 400);
    }

    const dateIso = body.date;
    const weekStart = weekStartFromDateIso(dateIso);
    const period = toPeriod(new Date(`${dateIso}T00:00:00.000Z`));

    const normalized = body.entries.map((e) => {
      const absent = Boolean(e.absent);
      const worked = absent ? 0 : Math.max(0, Math.min(24, Number(e.workedHours ?? 0)));
      return { employeeId: e.employeeId, workedHours: worked, absent };
    });

    if (!normalized.every((e) => typeof e.employeeId === "string" && e.employeeId.length > 0)) {
      return apiError("Each entry needs a valid employeeId", 400);
    }

    const employeeIds = normalized.map((e) => e.employeeId as string);
    if (new Set(employeeIds).size !== employeeIds.length) {
      return apiError("Duplicate employee in batch", 400);
    }

    const employees = await prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
        demoSessionId: session.demoSessionId,
        status: { not: "EXITED" },
        ...(session.role === "SITE_SUPERVISOR"
          ? { siteAssignment: { site: { supervisorUserId: session.userId } } }
          : {}),
      },
      select: { id: true, contractStart: true, siteAssignment: { select: { siteId: true } } },
    });

    if (employees.length !== employeeIds.length) {
      return apiError("One or more employees are invalid or not on your site", 400);
    }

    const joinById = new Map(employees.map((e) => [e.id, e.contractStart]));
    const hasEntryBeforeJoin = normalized.some((e) => {
      const start = joinById.get(e.employeeId as string);
      return Boolean(start && !isTimesheetDateOnOrAfterJoining(dateIso, start));
    });
    if (hasEntryBeforeJoin) {
      return apiError("Cannot record timesheet before the employee’s date of joining (contract start).", 400);
    }

    const siteIds = [...new Set(employees.map((e) => e.siteAssignment?.siteId).filter(Boolean) as string[])];
    for (const siteId of siteIds) {
      const sub = await prisma.siteTimesheetSubmission.findFirst({
        where: {
          demoSessionId: session.demoSessionId,
          siteId,
          period,
        },
        select: { status: true, note: true },
      });
      const dayLocks = parseLockNote(sub?.note ?? null).dayLocks ?? [];
      if (sub?.status === "LOCKED" || dayLocks.includes(dateIso)) {
        return apiError("This site period is locked. Timesheets are now read-only.", 409);
      }
    }

    const existing = await prisma.timesheet.findMany({
      where: {
        weekStart,
        employeeId: { in: employeeIds },
        employee: { demoSessionId: session.demoSessionId },
      },
      select: { id: true, employeeId: true, status: true, dailyBreakdown: true },
    });
    const byEmp = new Map(existing.map((t) => [t.employeeId, t]));

    for (const t of existing) {
      if (t.status === "LOCKED" || t.status === "VALIDATED") {
        return apiError("Timesheet is locked or validated and cannot be edited.", 409);
      }
    }

    const results: unknown[] = [];

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < normalized.length; i++) {
        const { employeeId, workedHours, absent } = normalized[i];
        if (!employeeId) continue;
        const siteIdSnapshot = employees.find((e) => e.id === employeeId)?.siteAssignment?.siteId ?? null;
        const prev = byEmp.get(employeeId);
        const dayRegular = absent ? 0 : Math.min(8, workedHours);
        const dayOt = absent ? 0 : Math.max(0, workedHours - 8);

        const existingBreakdown: BreakdownDay[] =
          prev && Array.isArray((prev as { dailyBreakdown?: unknown }).dailyBreakdown)
            ? (((prev as { dailyBreakdown?: unknown }).dailyBreakdown as Array<Record<string, unknown>>)
                .filter((row) => typeof row?.date === "string")
                .map((row) => {
                  const base: BreakdownDay = {
                    date: String(row.date),
                    regular: Number(row.regular ?? 0),
                    ot: Number(row.ot ?? 0),
                  };
                  if (row.absent === true) base.absent = true;
                  return base;
                }))
            : [];
        const withoutDay = existingBreakdown.filter((row) => row.date !== dateIso);
        const dayRow: BreakdownDay = absent
          ? { date: dateIso, regular: 0, ot: 0, absent: true }
          : { date: dateIso, regular: dayRegular, ot: dayOt };
        const mergedBreakdown = [...withoutDay, dayRow].sort((a, b) => a.date.localeCompare(b.date));
        const totalRegular = mergedBreakdown.reduce((acc, row) => acc + row.regular, 0);
        const totalOt = mergedBreakdown.reduce((acc, row) => acc + row.ot, 0);
        const dailyBreakdown: Prisma.InputJsonValue = mergedBreakdown as unknown as Prisma.InputJsonValue;

        if (prev) {
          const updated = await tx.timesheet.update({
            where: { id: prev.id },
            data: {
              hoursWorked: totalRegular,
              overtimeHrs: totalOt,
              dailyBreakdown,
              period,
              siteIdSnapshot,
              status: prev.status === "REJECTED" ? "DRAFT" : prev.status,
            },
          });
          results.push(updated);
        } else {
          const created = await tx.timesheet.create({
            data: {
              employeeId,
              weekStart,
              hoursWorked: totalRegular,
              overtimeHrs: totalOt,
              dailyBreakdown,
              period,
              siteIdSnapshot,
              status: "DRAFT",
            },
          });
          results.push(created);
        }
      }
    });

    return Response.json({ saved: results.length, items: results });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to save daily timesheets", 400);
  }
}
