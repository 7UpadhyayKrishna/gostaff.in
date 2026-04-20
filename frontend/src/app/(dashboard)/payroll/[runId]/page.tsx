"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { PayslipCard } from "@/src/components/payroll/PayslipCard";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { StatCard } from "@/src/components/layout/StatCard";
import { AccessDenied } from "@/src/components/layout/AccessDenied";
import { canAccessPage } from "@/src/lib/permissions";
import { ROLES, type AppRole } from "@/src/lib/roles";

type RunDetail = {
  id: string;
  month: string;
  status: string;
  totalEmployees: number;
  totalGross: number;
  totalNet: number;
  payslips: Array<{ id: string; month: string; netSalary: number; grossSalary: number; wpsStatus: string; employee?: { fullName?: string } }>;
  auditLogs?: Array<{
    id: string;
    action: string;
    fromStatus?: string | null;
    toStatus: string;
    createdAt: string;
    actorUser?: { name?: string; email?: string };
  }>;
  rejectedNote?: string | null;
};

export default function PayrollRunDetailPage() {
  const { data: session, status: sessionStatus } = useSession();
  const params = useParams<{ runId: string }>();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const role = (session?.user as { role?: AppRole } | undefined)?.role;
  const hasPageAccess = canAccessPage("/payroll/[runId]", role);

  const loadRun = useCallback(async () => {
    const response = await fetch(`/api/payroll/${params.runId}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? "Unable to load run");
    setRun(payload ?? null);
  }, [params.runId]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !hasPageAccess) return;
    loadRun().catch((e) => setError(e instanceof Error ? e.message : "Unable to load run"));
  }, [hasPageAccess, loadRun, sessionStatus]);

  async function sendToPayroll() {
    const response = await fetch(`/api/payroll/${params.runId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "APPROVE" }) });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Unable to send payroll");
      return;
    }
    await loadRun();
  }

  async function submitForApproval() {
    const response = await fetch(`/api/payroll/${params.runId}/submit`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      const blockers = Array.isArray(payload?.blockers)
        ? payload.blockers.map((b: { message?: string }) => `- ${b?.message ?? "Unknown blocker"}`).join("\n")
        : "";
      setError(
        blockers
          ? `${payload?.message ?? "Unable to submit run"}\n${blockers}`
          : (payload?.message ?? payload?.error ?? "Unable to submit run"),
      );
      return;
    }
    setMessage("Run submitted to Operation.");
    await loadRun();
  }

  async function rejectRun() {
    const response = await fetch(`/api/payroll/${params.runId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REJECT", note: rejectNote || "Rejected by Operation" }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Unable to reject run");
      return;
    }
    setMessage("Run rejected and returned to HR.");
    await loadRun();
  }

  async function exportPayslips() {
    const response = await fetch(`/api/payroll/${params.runId}/export`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Unable to export payslips");
      return;
    }
    setMessage(`Exported ${payload?.payslips?.length ?? 0} payslip lines.`);
    await loadRun();
  }

  async function exportWps() {
    const response = await fetch(`/api/payroll/${params.runId}/wps`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Unable to export WPS");
      return;
    }
    setMessage(`WPS export ready with ${payload?.wpsLines?.length ?? 0} rows.`);
  }

  async function closePeriod() {
    const confirmed = window.confirm("Close payroll period permanently? This action is irreversible.");
    if (!confirmed) return;
    const response = await fetch(`/api/payroll/${params.runId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationToken: "CONFIRM_CLOSE_PAYROLL" }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Unable to close period");
      return;
    }
    setMessage("Payroll period closed.");
    await loadRun();
  }

  if (sessionStatus === "loading") return <div>Loading payroll run...</div>;
  if (!hasPageAccess) return <AccessDenied message="You do not have access to this payroll run." />;
  if (!run) return <div>{error || "Loading payroll run..."}</div>;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Payroll Run ${run.month}`}
        subtitle="Payroll lifecycle: calculate, submit, approve, export, close."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {role === ROLES.HR_ADMIN && run.status === "COLLECTING" ? (
              <button className="rounded bg-indigo-600 px-3 py-2 text-white" onClick={submitForApproval}>
                Submit to Ops
              </button>
            ) : null}
            {role === ROLES.OPS_DIRECTOR && run.status === "READY_FOR_APPROVAL" ? (
              <>
                <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={sendToPayroll}>
                  Approve Run
                </button>
                <input
                  className="rounded border px-2 py-1 text-sm"
                  placeholder="Rejection note"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                />
                <button className="rounded bg-rose-600 px-3 py-2 text-white" onClick={rejectRun}>
                  Reject
                </button>
              </>
            ) : null}
            {(role === ROLES.HR_ADMIN || role === ROLES.OPS_DIRECTOR) && (run.status === "APPROVED" || run.status === "EXPORTED") ? (
              <>
                <button className="rounded bg-emerald-700 px-3 py-2 text-white" onClick={exportPayslips}>
                  Export Payslips
                </button>
                <button className="rounded bg-emerald-900 px-3 py-2 text-white" onClick={exportWps}>
                  Export WPS
                </button>
              </>
            ) : null}
            {role === ROLES.HR_ADMIN && (run.status === "APPROVED" || run.status === "EXPORTED") ? (
              <button className="rounded bg-slate-700 px-3 py-2 text-white" onClick={closePeriod}>
                Close Period
              </button>
            ) : null}
          </div>
        }
      />
      {run.rejectedNote ? <div className="rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">Rejected Note: {run.rejectedNote}</div> : null}
      {message ? <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-900">{message}</div> : null}
      {error ? <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Status" value={run.status} />
        <StatCard label="Employees Covered" value={run.totalEmployees} />
        <StatCard label="Total Gross" value={`AED ${run.totalGross.toFixed(2)}`} />
        <StatCard label="Total Net" value={`AED ${run.totalNet.toFixed(2)}`} />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {run.payslips.map((payslip) => (
          <PayslipCard key={payslip.id} payslip={payslip} />
        ))}
      </div>
      {Array.isArray(run.auditLogs) && run.auditLogs.length > 0 ? (
        <div className="rounded border p-3">
          <h3 className="mb-2 text-sm font-semibold">Audit Trail</h3>
          <div className="space-y-1 text-xs">
            {run.auditLogs.map((log) => (
              <div key={log.id} className="rounded bg-slate-50 p-2">
                {new Date(log.createdAt).toLocaleString()} - {log.action} ({log.fromStatus ?? "N/A"} {"->"} {log.toStatus}) by{" "}
                {log.actorUser?.name ?? log.actorUser?.email ?? "Unknown"}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
