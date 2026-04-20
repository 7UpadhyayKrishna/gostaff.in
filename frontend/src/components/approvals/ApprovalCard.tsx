"use client";

import { useState } from "react";

type ApprovalCardProps = {
  item: {
    id: string;
    status: string;
    note?: string | null;
    employee?: { fullName?: string; employeeId?: string; payrollConfig?: { basicSalary: number } | null };
  };
  onAction?: (id: string, action: "APPROVE" | "REJECT" | "FLAG", note?: string) => void;
};

export function ApprovalCard({ item, onAction }: ApprovalCardProps) {
  const [flagNote, setFlagNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [flagError, setFlagError] = useState("");
  const [rejectError, setRejectError] = useState("");

  function approve() {
    onAction?.(item.id, "APPROVE");
  }

  function flag() {
    const trimmed = flagNote.trim();
    if (!trimmed) {
      setFlagError("Add a remark for HR.");
      return;
    }
    setFlagError("");
    onAction?.(item.id, "FLAG", trimmed);
    setFlagNote("");
  }

  function reject() {
    const trimmed = rejectNote.trim();
    if (!trimmed) {
      setRejectError("Add a remark explaining the rejection.");
      return;
    }
    setRejectError("");
    onAction?.(item.id, "REJECT", trimmed);
    setRejectNote("");
  }

  return (
    <div className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="font-semibold">{item.employee?.fullName ?? "Employee"}</p>
          <p className="text-xs text-slate-500">{item.employee?.employeeId ?? "Draft"}</p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs">{item.status}</span>
      </div>

      <p className="text-sm text-slate-600">Salary: AED {item.employee?.payrollConfig?.basicSalary ?? "N/A"}</p>
      {item.note ? <p className="mt-1 text-sm text-amber-700">Note: {item.note}</p> : null}

      {onAction ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded bg-emerald-600 px-3 py-1 text-xs text-white" onClick={approve}>
              Approve
            </button>
          </div>

          <div className="rounded border border-amber-200 bg-amber-50/50 p-2">
            <p className="mb-1 text-xs font-medium text-amber-900">Flag to HR (needs action)</p>
            <textarea
              className="mb-1 min-h-16 w-full rounded border p-2 text-xs"
              placeholder="Remark for HR..."
              value={flagNote}
              onChange={(e) => {
                setFlagNote(e.target.value);
                setFlagError("");
              }}
            />
            {flagError ? <p className="mb-1 text-xs text-rose-600">{flagError}</p> : null}
            <button type="button" className="rounded bg-amber-500 px-3 py-1 text-xs text-white" onClick={flag}>
              Flag to HR
            </button>
          </div>

          <div className="rounded border border-rose-200 bg-rose-50/50 p-2">
            <p className="mb-1 text-xs font-medium text-rose-900">Reject</p>
            <textarea
              className="mb-1 min-h-16 w-full rounded border p-2 text-xs"
              placeholder="Reason for rejection..."
              value={rejectNote}
              onChange={(e) => {
                setRejectNote(e.target.value);
                setRejectError("");
              }}
            />
            {rejectError ? <p className="mb-1 text-xs text-rose-600">{rejectError}</p> : null}
            <button type="button" className="rounded bg-rose-600 px-3 py-1 text-xs text-white" onClick={reject}>
              Reject
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
