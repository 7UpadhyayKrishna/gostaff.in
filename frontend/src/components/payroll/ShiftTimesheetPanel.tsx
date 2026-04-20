"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Shift = {
  id: string;
  siteId: string;
  name: string;
  startTime: string;
  endTime: string;
};

type ShiftLine = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  attendanceStatus: "PRESENT" | "ABSENT" | null;
  hoursWorked: number;
  overtime: number;
  manualHoursOverride: boolean;
  isEligible: boolean;
};

type Site = { id: string; name: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toHours(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const mins = endMin > startMin ? endMin - startMin : endMin - startMin + 24 * 60;
  return mins / 60;
}

export function ShiftTimesheetPanel({ embed = false }: { embed?: boolean }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [lines, setLines] = useState<ShiftLine[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<string>("DRAFT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedShift = useMemo(() => shifts.find((s) => s.id === selectedShiftId) ?? null, [selectedShiftId, shifts]);
  const autoHours = selectedShift ? toHours(selectedShift.startTime, selectedShift.endTime) : 0;

  const loadSites = useCallback(async () => {
    const res = await fetch("/api/sites");
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error ?? "Unable to load sites");
    const list = (Array.isArray(payload) ? payload : []) as Site[];
    if (!selectedSiteId && list.length > 0) setSelectedSiteId(list[0].id);
  }, [selectedSiteId]);

  const loadShifts = useCallback(async (siteId: string) => {
    if (!siteId) return;
    const res = await fetch(`/api/shifts?siteId=${siteId}`);
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error ?? "Unable to load shifts");
    const list = Array.isArray(payload) ? payload : [];
    setShifts(list);
    if (!selectedShiftId && list.length > 0) setSelectedShiftId(list[0].id);
  }, [selectedShiftId]);

  async function loadShiftSheet(siteId: string, shiftId: string, date: string) {
    if (!siteId || !shiftId || !date) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/timesheets/shifts?siteId=${siteId}&shiftId=${shiftId}&date=${date}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error ?? "Unable to load shift sheet");
      setLines(Array.isArray(payload?.lines) ? payload.lines : []);
      setSubmissionId(payload?.submission?.id ?? null);
      setSubmissionStatus(payload?.submission?.status ?? "DRAFT");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load shift sheet");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSites().catch((e) => setError(e instanceof Error ? e.message : "Unable to load sites"));
  }, [loadSites]);

  useEffect(() => {
    loadShifts(selectedSiteId).catch((e) => setError(e instanceof Error ? e.message : "Unable to load shifts"));
  }, [selectedSiteId, loadShifts]);

  useEffect(() => {
    loadShiftSheet(selectedSiteId, selectedShiftId, selectedDate).catch(() => {});
  }, [selectedSiteId, selectedShiftId, selectedDate]);

  function updateLine(employeeId: string, patch: Partial<ShiftLine>) {
    setLines((prev) => prev.map((line) => (line.employeeId === employeeId ? { ...line, ...patch } : line)));
  }

  async function saveDraft() {
    if (!selectedSiteId || !selectedShiftId) return;
    setError("");
    const entries = lines
      .filter((line) => line.isEligible)
      .map((line) => ({
        employeeId: line.employeeId,
        attendanceStatus: line.attendanceStatus ?? "PRESENT",
        hoursWorked: line.attendanceStatus === "ABSENT" ? 0 : line.hoursWorked,
        overtime: line.attendanceStatus === "ABSENT" ? 0 : line.overtime,
        manualHoursOverride: line.manualHoursOverride,
      }));
    const res = await fetch("/api/timesheets/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId: selectedSiteId, shiftId: selectedShiftId, date: selectedDate, entries }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error ?? "Unable to save draft");
    await loadShiftSheet(selectedSiteId, selectedShiftId, selectedDate);
  }

  async function submitShift() {
    if (!selectedSiteId || !selectedShiftId) return;
    await saveDraft();
    const res = await fetch("/api/timesheets/shifts/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId: selectedSiteId, shiftId: selectedShiftId, date: selectedDate }),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error ?? "Unable to submit shift");
    await loadShiftSheet(selectedSiteId, selectedShiftId, selectedDate);
  }

  const shell = embed ? "space-y-4" : "space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5";

  return (
    <div className={shell}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
          <label className="block text-xs font-medium text-slate-600">
            Date
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Shift
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
            >
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} ({shift.startTime} - {shift.endTime})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
          Default hours: <span className="tabular-nums text-slate-900">{autoHours.toFixed(1)}</span>
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading shift data…</p> : null}

      {selectedShiftId ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/90">
              <tr>
                <th className="p-2 text-left">Employee</th>
                <th className="p-2 text-left">Attendance</th>
                <th className="p-2 text-left">Hours</th>
                <th className="p-2 text-left">Overtime</th>
                <th className="p-2 text-left">Manual</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.employeeId} className="border-b border-slate-100 transition hover:bg-slate-50/80 last:border-0">
                  <td className="p-2">
                    <div className="font-medium">{line.employeeName}</div>
                    <div className="text-xs text-slate-500">{line.employeeCode}</div>
                  </td>
                  <td className="p-2">
                    <select
                      className="rounded border px-2 py-1"
                      disabled={!line.isEligible || submissionStatus === "APPROVED"}
                      value={line.attendanceStatus ?? "PRESENT"}
                      onChange={(e) => updateLine(line.employeeId, { attendanceStatus: e.target.value as "PRESENT" | "ABSENT" })}
                    >
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      className="w-24 rounded border px-2 py-1"
                      type="number"
                      min={0}
                      max={24}
                      step={0.5}
                      disabled={!line.isEligible || line.attendanceStatus === "ABSENT" || submissionStatus === "APPROVED"}
                      value={line.hoursWorked}
                      onChange={(e) => updateLine(line.employeeId, { hoursWorked: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="w-24 rounded border px-2 py-1"
                      type="number"
                      min={0}
                      max={24}
                      step={0.5}
                      disabled={!line.isEligible || line.attendanceStatus === "ABSENT" || submissionStatus === "APPROVED"}
                      value={line.overtime}
                      onChange={(e) => updateLine(line.employeeId, { overtime: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={line.manualHoursOverride}
                      disabled={submissionStatus === "APPROVED"}
                      onChange={(e) => updateLine(line.employeeId, { manualHoursOverride: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/90 p-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
              disabled={submissionStatus === "APPROVED"}
              onClick={() => submitShift().catch((e) => setError(e.message))}
            >
              Submit for approval
            </button>
            <span className="text-xs font-medium text-slate-600">
              Status:{" "}
              <span className="rounded-md bg-white px-2 py-0.5 font-semibold text-slate-800">{submissionStatus}</span>
              {submissionId ? <span className="ml-1 font-mono text-slate-500">({submissionId.slice(0, 8)})</span> : null}
            </span>
          </div>
        </div>
      ) : null}

      {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</div> : null}
    </div>
  );
}
