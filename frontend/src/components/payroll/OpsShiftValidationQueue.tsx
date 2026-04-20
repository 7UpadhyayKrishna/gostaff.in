"use client";

import { useCallback, useEffect, useState } from "react";

type QueueItem = {
  id: string;
  date: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  rejectionRemark: string | null;
  site: { id: string; name: string };
  shift: { id: string; name: string; startTime: string; endTime: string };
  lineItems: Array<{
    id: string;
    attendanceStatus: "PRESENT" | "ABSENT";
    hoursWorked: number;
    overtime: number;
    employee: { employeeId: string; fullName: string };
  }>;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function OpsShiftValidationQueue({ embed = false }: { embed?: boolean }) {
  const [date, setDate] = useState(todayIso());
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [remarkById, setRemarkById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/timesheets/shifts/queue?date=${date}&status=SUBMITTED`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Unable to load submitted shifts");
      setItems(Array.isArray(payload) ? payload : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load submitted shifts");
    } finally {
      setLoading(false);
    }
  }, [date]);

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/timesheets/shifts/queue/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, remark: remarkById[id] ?? "" }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Unable to update shift decision");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update shift decision");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const shell = embed ? "space-y-4" : "space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5";

  return (
    <div className={shell}>
      <label className="block max-w-xs text-xs font-medium text-slate-600">
        Queue date
        <input
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      {loading ? <p className="text-sm text-slate-500">Loading submitted shifts…</p> : null}

      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">No submitted shifts for the selected date.</p> : null}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
            <div className="mb-1 text-sm font-medium text-slate-900">
              {item.site.name} - {item.shift.name} ({item.shift.startTime} - {item.shift.endTime})
            </div>
            <div className="mb-2 text-xs text-slate-500">{item.date.slice(0, 10)} | {item.status}</div>
            <div className="space-y-1 text-xs text-slate-700">
              {item.lineItems.map((line) => (
                <div key={line.id}>
                  {line.employee.fullName} ({line.employee.employeeId}) - {line.attendanceStatus}, Hours: {line.hoursWorked}, OT: {line.overtime}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <input
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 sm:min-w-[240px]"
                placeholder="Remark (required for reject)"
                value={remarkById[item.id] ?? ""}
                onChange={(e) => setRemarkById((prev) => ({ ...prev, [item.id]: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
                  disabled={busyId === item.id}
                  onClick={() => decide(item.id, "APPROVE").catch(() => {})}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-800 disabled:opacity-50"
                  disabled={busyId === item.id}
                  onClick={() => decide(item.id, "REJECT").catch(() => {})}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</div> : null}
    </div>
  );
}
