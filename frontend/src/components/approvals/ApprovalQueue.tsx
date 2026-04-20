"use client";

import { useCallback, useEffect, useState } from "react";
import { ApprovalCard } from "@/src/components/approvals/ApprovalCard";
import { PageHeader } from "@/src/components/layout/PageHeader";

type ApprovalItem = {
  id: string;
  status: string;
  submittedAt?: string;
  note?: string | null;
  employee?: { fullName?: string; employeeId?: string; payrollConfig?: { basicSalary: number } | null };
};

export function ApprovalQueue() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/approvals");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? "Unable to load approvals");
    setItems(Array.isArray(payload) ? payload : []);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Unable to load approvals"));
  }, [load]);

  async function onAction(id: string, action: "APPROVE" | "REJECT" | "FLAG", note?: string) {
    try {
      setBusyId(id);
      const response = await fetch(`/api/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(note != null && note !== "" ? { note } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Action failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function bulkApproveVisible() {
    const visible = items.filter((item) => (statusFilter === "ALL" ? true : item.status === statusFilter)).filter((item) => {
      const text = `${item.employee?.fullName ?? ""} ${item.employee?.employeeId ?? ""}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });
    const pending = visible.filter((item) => item.status === "PENDING");
    if (!pending.length) return;

    setBulkBusy(true);
    setError("");
    try {
      await Promise.all(
        pending.map((item) =>
          fetch(`/api/approvals/${item.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "APPROVE" as const }),
          }),
        ),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  }

  if (error) return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>;
  if (items.length === 0) return <div className="text-sm text-slate-500">No pending approvals.</div>;

  const filtered = items
    .filter((item) => (statusFilter === "ALL" ? true : item.status === statusFilter))
    .filter((item) => {
      const text = `${item.employee?.fullName ?? ""} ${item.employee?.employeeId ?? ""}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });

  return (
    <div className="space-y-2">
      <PageHeader
        title="Approvals Queue"
        subtitle="Review compensation impact and decide onboarding submissions."
        action={
          <button
            disabled={bulkBusy}
            className="rounded bg-emerald-700 px-3 py-2 text-xs text-white disabled:opacity-60"
            onClick={bulkApproveVisible}
          >
            {bulkBusy ? "Approving..." : "Bulk Approve Visible"}
          </button>
        }
      />
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Search employee"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="rounded border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="PENDING">Pending</option>
          <option value="ALL">All statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CONDITIONALLY_APPROVED">Conditionally approved</option>
        </select>
      </div>
      {busyId ? <div className="text-xs text-slate-500">Updating {busyId}...</div> : null}
      {filtered.map((item) => (
        <ApprovalCard key={item.id} item={item} onAction={onAction} />
      ))}
      {filtered.length === 0 ? <p className="text-sm text-slate-500">No approvals match your filters.</p> : null}
    </div>
  );
}
