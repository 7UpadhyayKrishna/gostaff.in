"use client";

import { useEffect, useState } from "react";
import { PayrollRunTable } from "@/src/components/payroll/PayrollRunTable";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { StatCard } from "@/src/components/layout/StatCard";
import { useSession } from "next-auth/react";

type PayrollRun = {
  id: string;
  month: string;
  status: string;
  totalEmployees: number;
  totalGross: number;
  totalNet: number;
};

export function PayrollPageClient() {
  const { data: session } = useSession();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const role = (session?.user as any)?.role as string | undefined;
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState("");

  async function loadRuns() {
    const response = await fetch("/api/payroll");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? "Unable to load payroll runs");
    setRuns(Array.isArray(payload) ? payload : []);
  }

  useEffect(() => {
    loadRuns().catch((e) => setError(e instanceof Error ? e.message : "Unable to load payroll runs"));
  }, []);

  async function createRun() {
    setError("");
    const response = await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Unable to create run");
      return;
    }
    await loadRuns();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Monthly Payroll Workbench"
        subtitle="Validate approved timesheets, monitor exceptions, and send runs to payroll."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total Runs" value={runs.length} />
        <StatCard label="Ready For Approval" value={runs.filter((run) => run.status === "READY_FOR_APPROVAL").length} tone="warning" />
        <StatCard label="Approved" value={runs.filter((run) => run.status === "APPROVED").length} tone="success" />
        <StatCard label="Closed" value={runs.filter((run) => run.status === "CLOSED").length} />
      </div>

      {role === "HR_ADMIN" ? (
        <div className="flex items-center gap-2">
          <input className="rounded border p-2" value={month} onChange={(e) => setMonth(e.target.value)} />
          <button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={createRun}>
            Create / Recalculate Run
          </button>
        </div>
      ) : null}

      {error ? <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">{error}</div> : null}
      <PayrollRunTable runs={runs} />
    </div>
  );
}
