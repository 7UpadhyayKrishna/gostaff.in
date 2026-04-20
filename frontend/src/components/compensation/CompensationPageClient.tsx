"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { CollapsibleSection } from "@/src/components/layout/CollapsibleSection";
import { cn } from "@/src/lib/utils";

type MonthRow = {
  period: string;
  grossSalary: number;
  netSalary: number;
  allowances: number;
  deductions: number;
  billedGross26: number;
};

type EmployeeRow = {
  id: string;
  fullName: string;
  employeeId: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  byMonth: MonthRow[];
  totalGross: number;
  totalNet: number;
  totalBilledGross26: number;
  unbilledHours: number;
  unbilledGross26: number;
};

type SortKey = "name" | "basic" | "unbilledHrs" | "billed26" | "totalGross" | "totalNet";

function formatAed(n: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 2 }).format(n);
}

function formatHours(n: number) {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 }).format(n);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function CompensationPageClient() {
  const [asOfMonth, setAsOfMonth] = useState(currentMonth);
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/dashboard/compensation-summary?asOfMonth=${encodeURIComponent(asOfMonth)}`);
      const payload = await r.json();
      if (!r.ok) {
        setError(typeof payload?.error === "string" ? payload.error : "Unable to load compensation summary");
        setRows([]);
        return;
      }
      setRows(Array.isArray(payload?.employees) ? payload.employees : []);
    } catch {
      setError("Unable to load compensation summary");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [asOfMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((e) => e.fullName.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q));
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      switch (sort.key) {
        case "basic":
          return (a.basicSalary - b.basicSalary) * dir;
        case "unbilledHrs":
          return (a.unbilledHours - b.unbilledHours) * dir;
        case "billed26":
          return (a.totalBilledGross26 - b.totalBilledGross26) * dir;
        case "totalGross":
          return (a.totalGross - b.totalGross) * dir;
        case "totalNet":
          return (a.totalNet - b.totalNet) * dir;
        default:
          return a.fullName.localeCompare(b.fullName) * dir;
      }
    });
    return sorted;
  }, [query, rows, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" },
    );
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sortHint = (key: SortKey) => (sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm md:px-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">Compensation accrual</h1>
        <p className="mt-1 text-sm text-slate-600">
          Locked timesheets feed payroll run totals and client billing (X+Y+Z over 26 days). Open timesheets contribute unbilled hours
          and estimated billing at those rates. Collapse the formula when you are focused on numbers.
        </p>
      </div>

      <CollapsibleSection
        title="26-day billing formula"
        subtitle="Reference: how daily and hourly rates and overtime relate to the 26-day month."
        defaultOpen={false}
      >
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-slate-800">
          <p className="font-semibold text-slate-900">Locked = billed path</p>
          <p className="mt-2 leading-relaxed text-slate-700">
            Monthly total <span className="font-mono font-medium">T</span> = Basic + Housing + Transport. Daily rate = T ÷ 26. Hourly =
            daily ÷ 8. Weekday OT = hourly × 1.25. Example day: (8 × hourly) + (2 × OT rate). Friday hours use 1.5 × hourly; public
            holidays use 2 × hourly (same base hourly).
          </p>
        </div>
      </CollapsibleSection>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 md:px-5">
          <h2 className="text-sm font-semibold text-slate-900">Filters & refresh</h2>
          <p className="text-xs text-slate-600">Choose the accrual month, search the roster, then reload from the server.</p>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:flex-wrap md:items-end md:px-5">
          <label className="text-xs font-medium text-slate-600">
            Accrue through month
            <input
              type="month"
              value={asOfMonth}
              onChange={(e) => setAsOfMonth(e.target.value)}
              className="mt-1 block w-full min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 md:w-auto"
            />
          </label>
          <div className="relative min-w-0 flex-1 md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              placeholder="Name or employee ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              aria-label="Filter employees"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-950">{error}</div>
      ) : null}

      <CollapsibleSection
        title="Employee accrual table"
        subtitle="Sort columns to compare billing vs payroll. Expand a row for per-month locked detail."
        defaultOpen
        badge={
          !loading ? (
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-800">{filteredSorted.length}</span>
          ) : null
        }
      >
        {loading ? (
          <p className="text-sm text-slate-500">Loading compensation…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/90">
                <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">
                    <button type="button" className="font-semibold text-slate-600 hover:text-slate-900" onClick={() => toggleSort("name")}>
                      Employee{sortHint("name")}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right">
                    <button type="button" className="font-semibold text-slate-600 hover:text-slate-900" onClick={() => toggleSort("basic")}>
                      Basic{sortHint("basic")}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right">Housing</th>
                  <th className="px-3 py-3 text-right">Transport</th>
                  <th className="px-3 py-3 text-right">
                    <button
                      type="button"
                      className="font-semibold text-slate-600 hover:text-slate-900"
                      onClick={() => toggleSort("unbilledHrs")}
                    >
                      Unbilled hrs{sortHint("unbilledHrs")}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold leading-tight">
                    Unbilled
                    <br />
                    (26-day est.)
                  </th>
                  <th className="px-3 py-3 text-right">
                    <button type="button" className="font-semibold text-slate-600 hover:text-slate-900" onClick={() => toggleSort("billed26")}>
                      Billed (26-day){sortHint("billed26")}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right">
                    <button type="button" className="font-semibold text-slate-600 hover:text-slate-900" onClick={() => toggleSort("totalGross")}>
                      Payroll gross{sortHint("totalGross")}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right">
                    <button type="button" className="font-semibold text-slate-600 hover:text-slate-900" onClick={() => toggleSort("totalNet")}>
                      Payroll net{sortHint("totalNet")}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-center">Flags</th>
                  <th className="px-3 py-3 text-right">Months</th>
                </tr>
              </thead>
              <tbody>
                {filteredSorted.map((e) => {
                  const open = expanded.has(e.id);
                  const hasUnbilled = e.unbilledHours > 0.01;
                  const hasBilled = e.totalBilledGross26 > 0;
                  return (
                    <Fragment key={e.id}>
                      <tr className="border-b border-slate-100 transition hover:bg-slate-50/80">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-900">{e.fullName}</div>
                          <div className="text-xs text-slate-500">{e.employeeId}</div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-800">{formatAed(e.basicSalary)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatAed(e.housingAllowance)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatAed(e.transportAllowance)}</td>
                        <td className="px-3 py-3 text-right tabular-nums font-medium text-amber-950">{formatHours(e.unbilledHours)}</td>
                        <td className="px-3 py-3 text-right tabular-nums font-medium text-amber-900">{formatAed(e.unbilledGross26)}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{formatAed(e.totalBilledGross26)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{formatAed(e.totalGross)}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-800">{formatAed(e.totalNet)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-center gap-1 sm:flex-row sm:flex-wrap sm:justify-center">
                            {hasUnbilled ? (
                              <span className="whitespace-nowrap rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
                                Unbilled
                              </span>
                            ) : null}
                            {hasBilled ? (
                              <span className="whitespace-nowrap rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-950">
                                Billed
                              </span>
                            ) : null}
                            {!hasUnbilled && !hasBilled ? <span className="text-xs text-slate-400">—</span> : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleExpand(e.id)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                          >
                            {e.byMonth.length} mo. · {open ? "Hide" : "Detail"}
                          </button>
                        </td>
                      </tr>
                      {open && e.byMonth.length > 0 ? (
                        <tr className="border-b border-slate-100 bg-slate-50/90">
                          <td colSpan={11} className="px-3 py-4">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Per-month (locked timesheets)</p>
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                              <table className="w-full text-xs">
                                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-semibold">Period</th>
                                    <th className="px-3 py-2 text-right font-semibold">Billed (26-day)</th>
                                    <th className="px-3 py-2 text-right font-semibold">Allowances*</th>
                                    <th className="px-3 py-2 text-right font-semibold">Payroll gross</th>
                                    <th className="px-3 py-2 text-right font-semibold">Deductions</th>
                                    <th className="px-3 py-2 text-right font-semibold">Payroll net</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {e.byMonth.map((m) => (
                                    <tr key={m.period} className="border-b border-slate-100 last:border-0">
                                      <td className="px-3 py-2 font-medium text-slate-800">{m.period}</td>
                                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{formatAed(m.billedGross26)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatAed(m.allowances)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums">{formatAed(m.grossSalary)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatAed(m.deductions)}</td>
                                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-800">{formatAed(m.netSalary)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                              *Payroll allowances: housing, transport, OT premiums, and public-holiday pay (30-day payroll rules). Unbilled
                              hours = DRAFT / SUBMITTED / VALIDATED timesheets only (not LOCKED or REJECTED).
                            </p>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {!loading && filteredSorted.length === 0 ? (
              <p className="border-t border-slate-100 p-4 text-center text-sm text-slate-500">
                No active employees with payroll config, or no matching rows.
              </p>
            ) : null}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
