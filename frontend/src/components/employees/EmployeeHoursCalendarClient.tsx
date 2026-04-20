"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/src/components/layout/PageHeader";

type DayEntry = { date: string; regular: number; ot: number; total: number };
type WeekInfo = { weekStart: string; status: string };

type Payload = {
  month: string;
  employee: { id: string; fullName: string; employeeId: string };
  days: DayEntry[];
  weeks: WeekInfo[];
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Build Mon–Sun grid cells for a calendar month (leading/trailing blanks). */
function monthGrid(year: number, monthIndex0: number) {
  const first = new Date(Date.UTC(year, monthIndex0, 1));
  const lastDay = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  // Monday = 0 ... Sunday = 6
  let startDow = first.getUTCDay() - 1;
  if (startDow < 0) startDow = 6;
  const cells: Array<{ date: string | null; inMonth: boolean }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ date: null, inMonth: false });
  for (let d = 1; d <= lastDay; d++) {
    cells.push({
      date: `${year}-${pad(monthIndex0 + 1)}-${pad(d)}`,
      inMonth: true,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, inMonth: false });
  return cells;
}

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function EmployeeHoursCalendarClient({ employeeId }: { employeeId: string }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/employees/${employeeId}/daily-hours?month=${encodeURIComponent(month)}`);
      const payload = await r.json();
      if (!r.ok) {
        setError(typeof payload?.error === "string" ? payload.error : "Unable to load hours");
        setData(null);
        return;
      }
      setData(payload as Payload);
    } catch {
      setError("Unable to load hours");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDate = useMemo(() => {
    const m = new Map<string, DayEntry>();
    for (const d of data?.days ?? []) m.set(d.date, d);
    return m;
  }, [data?.days]);

  const [y, mo] = month.split("-").map(Number);
  const grid = useMemo(() => monthGrid(y, mo - 1), [y, mo]);

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
  }

  const title = data?.employee
    ? `${data.employee.fullName} (${data.employee.employeeId})`
    : "Employee hours";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Daily hours"
        subtitle={title}
        action={
          <Link href={`/employees/${employeeId}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Back to profile
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <button
          type="button"
          aria-label="Previous month"
          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          aria-label="Next month"
          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading calendar…</p> : null}

      {data?.weeks?.length ? (
        <p className="text-xs text-slate-500">
          Timesheet weeks touching this month:{" "}
          {data.weeks.map((w) => `${w.weekStart} (${w.status})`).join(" · ")}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-slate-500">
          {weekdayLabels.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, idx) => {
            if (!cell.date) {
              return <div key={`empty-${idx}`} className="min-h-[72px] rounded-lg bg-slate-50/50" />;
            }
            const entry = byDate.get(cell.date);
            const total = entry?.total ?? 0;
            const reg = entry?.regular ?? 0;
            const ot = entry?.ot ?? 0;
            const has = total > 0 || reg > 0 || ot > 0;
            return (
              <div
                key={cell.date}
                className={`flex min-h-[72px] flex-col rounded-lg border p-1.5 text-left ${
                  has ? "border-emerald-200 bg-emerald-50/60" : "border-slate-100 bg-white"
                }`}
              >
                <span className="text-[11px] font-medium text-slate-500">{Number(cell.date.slice(8, 10))}</span>
                {has ? (
                  <>
                    <span className="text-sm font-semibold text-slate-900">{total.toFixed(1)}h</span>
                    <span className="text-[10px] leading-tight text-slate-600">
                      {reg > 0 ? `${reg.toFixed(1)} reg` : ""}
                      {reg > 0 && ot > 0 ? " · " : ""}
                      {ot > 0 ? `${ot.toFixed(1)} OT` : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-slate-400">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Hours come from timesheet daily breakdown (or weekly totals spread across Mon–Sat when no breakdown exists). Weeks that span two months may
        appear under the prior period in data; both months are queried so edge days still show.
      </p>
    </div>
  );
}
