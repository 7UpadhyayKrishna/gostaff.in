import { prisma } from "@/src/lib/prisma";
import { normalizeDailyLines } from "@/src/lib/payroll/from-timesheets";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function prevCalendarMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return null;
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

function isValidMonth(s: string) {
  return /^\d{4}-\d{2}$/.test(s);
}

function startOfMonth(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`);
}

function nextMonth(month: string) {
  const d = startOfMonth(month);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

function weekStartIsoFromDate(date: Date) {
  const d = new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "SITE_SUPERVISOR", "OWNER"]);
    const { id } = await params;

    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month");
    const month = monthParam && isValidMonth(monthParam) ? monthParam : new Date().toISOString().slice(0, 7);

    const employee = await prisma.employee.findFirst({
      where: {
        id,
        demoSessionId: session.demoSessionId,
        ...(session.role === "SITE_SUPERVISOR"
          ? {
              siteAssignment: {
                site: {
                  supervisorUserId: session.userId,
                },
              },
            }
          : {}),
      },
      select: { id: true, fullName: true, employeeId: true },
    });

    if (!employee) return apiError("Employee not found", 404);

    const prev = prevCalendarMonth(month);
    const periodFilter = prev ? { in: [month, prev] as string[] } : month;
    const monthStart = startOfMonth(month);
    const monthEnd = nextMonth(month);

    const [timesheets, approvedEntries] = await Promise.all([
      prisma.timesheet.findMany({
        where: {
          employeeId: id,
          employee: { demoSessionId: session.demoSessionId },
          period: periodFilter,
        },
        select: {
          id: true,
          weekStart: true,
          status: true,
          period: true,
          dailyBreakdown: true,
          hoursWorked: true,
          overtimeHrs: true,
        },
        orderBy: { weekStart: "asc" },
      }),
      prisma.payrollEntry.findMany({
        where: {
          demoSessionId: session.demoSessionId,
          employeeId: id,
          date: { gte: monthStart, lt: monthEnd },
          shiftSubmission: { status: "APPROVED" },
        },
        select: { date: true, hoursWorked: true, overtime: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const byDate = new Map<string, { regular: number; ot: number }>();
    const weekMeta = new Map<string, { status: string; weekStart: string }>();

    // Prefer approved shift entries for daily display (validated flow).
    for (const entry of approvedEntries) {
      const date = entry.date.toISOString().slice(0, 10);
      const ot = asNumber(entry.overtime);
      const total = asNumber(entry.hoursWorked);
      const regular = Math.max(0, total - ot);
      const cur = byDate.get(date) ?? { regular: 0, ot: 0 };
      byDate.set(date, { regular: cur.regular + regular, ot: cur.ot + ot });
      const ws = weekStartIsoFromDate(entry.date);
      if (!weekMeta.has(ws)) {
        weekMeta.set(ws, { status: "APPROVED", weekStart: ws });
      }
    }

    for (const ts of timesheets) {
      const ws = new Date(ts.weekStart).toISOString().slice(0, 10);
      if (!weekMeta.has(ws)) {
        weekMeta.set(ws, { status: ts.status, weekStart: ws });
      }

      const lines = normalizeDailyLines([ts]);
      for (const line of lines) {
        const date = typeof line.date === "string" ? line.date : "";
        if (!date || date.slice(0, 7) !== month) continue;
        if (byDate.has(date)) continue;
        const regular = asNumber(line.regular);
        const ot = asNumber(line.ot);
        const cur = byDate.get(date) ?? { regular: 0, ot: 0 };
        byDate.set(date, { regular: cur.regular + regular, ot: cur.ot + ot });
      }
    }

    const days = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        regular: Number(v.regular.toFixed(4)),
        ot: Number(v.ot.toFixed(4)),
        total: Number((v.regular + v.ot).toFixed(4)),
      }));

    const weeks = [...weekMeta.values()].filter((w) => {
      const start = new Date(`${w.weekStart}T00:00:00.000Z`);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        const iso = d.toISOString().slice(0, 10);
        if (iso.slice(0, 7) === month) return true;
      }
      return false;
    });

    return Response.json({
      month,
      employee,
      days,
      weeks,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch daily hours", 400);
  }
}
