"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CollapsibleSection } from "@/src/components/layout/CollapsibleSection";
import { useSession } from "next-auth/react";
import { ShiftTimesheetPanel } from "@/src/components/payroll/ShiftTimesheetPanel";
import { OpsShiftValidationQueue } from "@/src/components/payroll/OpsShiftValidationQueue";
import { cn } from "@/src/lib/utils";

type TimesheetRow = {
  id: string;
  weekStart: string;
  hoursWorked: number;
  overtimeHrs: number;
  status: "DRAFT" | "SUBMITTED" | "VALIDATED" | "LOCKED" | "REJECTED";
  employee?: { id?: string; fullName?: string; employeeId?: string };
};

function statusBadgeClass(status: string) {
  const s = status.toUpperCase();
  if (s === "LOCKED" || s === "VALIDATED") return "bg-emerald-100 text-emerald-900";
  if (s === "SUBMITTED") return "bg-sky-100 text-sky-950";
  if (s === "REJECTED") return "bg-rose-100 text-rose-900";
  if (s === "DRAFT") return "bg-amber-100 text-amber-950";
  return "bg-slate-100 text-slate-800";
}

export function TimesheetsPageClient() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [queue, setQueue] = useState<
    Array<{
      siteId: string;
      siteName: string;
      period: string;
      submissionStatus: string;
      assignedEmployees: number;
      expiredEmployeeCount: number;
    }>
  >([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("SUBMITTED");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [lockingSiteId, setLockingSiteId] = useState<string | null>(null);
  const [lockBlockersBySite, setLockBlockersBySite] = useState<Record<string, string[]>>({});
  const role = (session?.user as { role?: string })?.role as string | undefined;

  const load = useCallback(async () => {
    const response = await fetch("/api/timesheets");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? "Unable to load timesheets");
    const nextRows = Array.isArray(payload) ? payload : [];
    setRows(nextRows);

    if (role === "HR_ADMIN" || role === "OPS_DIRECTOR" || role === "OWNER" || role === "SITE_SUPERVISOR") {
      const queueResponse = await fetch(`/api/timesheets/validation-queue?period=${period}`);
      const queuePayload = await queueResponse.json();
      if (queueResponse.ok) setQueue(Array.isArray(queuePayload) ? queuePayload : []);
    }
  }, [period, role]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Unable to load timesheets"));
  }, [load]);

  const filtered = useMemo(
    () =>
      rows
        .filter((row) => (statusFilter === "ALL" ? true : row.status === statusFilter))
        .filter((row) => {
          const text = `${row.employee?.fullName ?? ""} ${row.employee?.employeeId ?? ""}`.toLowerCase();
          return text.includes(query.toLowerCase());
        }),
    [rows, statusFilter, query],
  );

  async function lockSite(siteId: string) {
    setLockingSiteId(siteId);
    setError("");
    const response = await fetch("/api/timesheets/lock-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, period }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const blockers = Array.isArray(payload?.blockers)
        ? payload.blockers.map((b: { message?: string }) => b?.message ?? "Unknown blocker")
        : [];
      if (blockers.length > 0) {
        setLockBlockersBySite((prev) => ({ ...prev, [siteId]: blockers }));
      }
      setError(payload?.message ?? payload?.error ?? "Unable to lock site timesheets");
      setLockingSiteId(null);
      return;
    }
    setLockBlockersBySite((prev) => ({ ...prev, [siteId]: [] }));
    await load();
    setLockingSiteId(null);
  }

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    try {
      setBusyId(id);
      const response = await fetch(`/api/timesheets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Unable to update timesheet");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update timesheet");
    } finally {
      setBusyId(null);
    }
  }

  const isOps = role === "OPS_DIRECTOR";
  const primaryTitle = isOps ? "Shift validation" : "Shift timesheets";
  const primarySubtitle = isOps
    ? "Review submitted shift bundles for the selected date, then approve or reject."
    : "Pick date and shift, enter attendance and hours, autosave drafts, then submit for approval.";

  if (role === "SITE_SUPERVISOR") {
    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm md:px-5">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">Timesheets</h1>
          <p className="mt-1 text-sm text-slate-600">Select date and shift, fill attendance, then submit for approval.</p>
        </div>
        <CollapsibleSection title="Today's shift entry" subtitle="Your site roster for the selected shift." defaultOpen>
          <ShiftTimesheetPanel embed />
        </CollapsibleSection>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm md:px-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">Timesheets</h1>
        <p className="mt-1 text-sm text-slate-600">
          Today&apos;s shift workflow, site lock queue, and historical weekly records — collapse sections to focus your screen.
        </p>
      </div>

      <CollapsibleSection title={primaryTitle} subtitle={primarySubtitle} defaultOpen>
        {isOps ? <OpsShiftValidationQueue embed /> : <ShiftTimesheetPanel embed />}
      </CollapsibleSection>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 md:px-5">
          <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
          <p className="text-xs text-slate-600">Narrow historical timesheets by month, employee text, and status.</p>
        </div>
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:flex-wrap md:items-center md:px-5">
          <label className="text-xs font-medium text-slate-600">
            Period
            <input
              className="mt-1 block w-full min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 md:w-auto"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
          <div className="relative min-w-0 flex-1 md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              placeholder="Filter by employee name or ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter timesheets by employee"
            />
          </div>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#3B82F6] md:w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="SUBMITTED">Submitted</option>
            <option value="VALIDATED">Validated</option>
            <option value="LOCKED">Locked</option>
            <option value="DRAFT">Draft</option>
            <option value="ALL">All statuses</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {queue.length > 0 && role !== "SITE_SUPERVISOR" ? (
        <CollapsibleSection
          title="Site submission queue"
          subtitle={`Monthly lock progress for ${period}. HR can lock a site once submissions are ready.`}
          defaultOpen
          badge={
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-800">{queue.length}</span>
          }
        >
          <div className="space-y-3">
            {queue.map((item) => (
              <div
                key={item.siteId}
                className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:grid-cols-[1fr_auto] md:items-start"
              >
                <div>
                  <p className="font-semibold text-slate-900">{item.siteName}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 font-medium",
                        item.submissionStatus === "LOCKED"
                          ? "bg-slate-200 text-slate-800"
                          : "bg-amber-100 text-amber-950",
                      )}
                    >
                      {item.submissionStatus}
                    </span>
                    <span className="rounded-md bg-white px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-200">
                      {item.assignedEmployees} employees
                    </span>
                    {item.expiredEmployeeCount > 0 ? (
                      <span className="rounded-md bg-rose-100 px-2 py-0.5 font-medium text-rose-900">
                        {item.expiredEmployeeCount} expired docs
                      </span>
                    ) : (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-900">Docs OK</span>
                    )}
                  </div>
                </div>
                {role === "HR_ADMIN" ? (
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
                    disabled={item.submissionStatus === "LOCKED" || lockingSiteId === item.siteId}
                    onClick={() => lockSite(item.siteId)}
                  >
                    {lockingSiteId === item.siteId ? "Locking…" : "Lock site"}
                  </button>
                ) : null}
                {Array.isArray(lockBlockersBySite[item.siteId]) && lockBlockersBySite[item.siteId].length > 0 ? (
                  <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                    {lockBlockersBySite[item.siteId].map((msg) => (
                      <div key={msg}>• {msg}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</div>
      ) : null}

      <CollapsibleSection
        title="Historical timesheets"
        subtitle="Weekly records for validation and audit. Expand when you need to approve or reject lines."
        defaultOpen={filtered.length > 0}
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/90">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">Employee</th>
                <th className="px-3 py-3">Week start</th>
                <th className="px-3 py-3">Hours</th>
                <th className="px-3 py-3">Overtime</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 transition hover:bg-slate-50/80 last:border-0">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-900">{row.employee?.fullName ?? "Employee"}</div>
                    <div className="text-xs text-slate-500">{row.employee?.employeeId ?? ""}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{new Date(row.weekStart).toLocaleDateString()}</td>
                  <td className="px-3 py-3 tabular-nums text-slate-800">{row.hoursWorked}</td>
                  <td className="px-3 py-3 tabular-nums text-slate-800">
                    {row.overtimeHrs}
                    {row.overtimeHrs > 10 ? (
                      <span className="ml-2 inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-950">
                        Spike
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", statusBadgeClass(row.status))}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {isOps && (row.status === "SUBMITTED" || row.status === "VALIDATED") ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                          onClick={() => decide(row.id, "APPROVE")}
                        >
                          Validate
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                          onClick={() => decide(row.id, "REJECT")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">{isOps ? "—" : "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? (
          <p className="mt-3 text-center text-sm text-slate-500">No timesheets match the current filters.</p>
        ) : null}
      </CollapsibleSection>
    </div>
  );
}
