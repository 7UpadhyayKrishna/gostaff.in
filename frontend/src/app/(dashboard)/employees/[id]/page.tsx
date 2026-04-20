"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { StatCard } from "@/src/components/layout/StatCard";

type EmployeeDetail = {
  id: string;
  employeeId: string;
  fullName: string;
  status: string;
  jobTitle: string;
  department: string;
  mobile: string;
  nationality: string;
  onboardingStage: number;
  payrollConfig?: { basicSalary?: number; paymentMethod?: string; iban?: string | null } | null;
  siteAssignment?: { shiftPattern?: string; shiftStart?: string; site?: { id?: string; name?: string } | null } | null;
  approval?: { status?: string; note?: string | null } | null;
  documents?: Array<{ id: string }>;
};

export default function Page() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [sites, setSites] = useState<Array<{ id: string; name: string; location: string }>>([]);
  const [assignSiteId, setAssignSiteId] = useState("");
  const [assignShift, setAssignShift] = useState("MORNING");
  const [assigning, setAssigning] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitFeedback, setResubmitFeedback] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const role = (session?.user as any)?.role as string | undefined;

  useEffect(() => {
    fetch(`/api/employees/${params.id}`)
      .then((r) => r.json())
      .then((payload) => {
        setEmployee(payload);
        setAssignSiteId(payload?.siteAssignment?.site?.id ?? "");
        setAssignShift(payload?.siteAssignment?.shiftPattern ?? "MORNING");
      })
      .catch(() => setError("Unable to load employee profile"));
  }, [params.id]);

  useEffect(() => {
    fetch("/api/sites")
      .then((r) => r.json())
      .then((payload) => setSites(Array.isArray(payload) ? payload : []))
      .catch(() => {});
  }, []);

  async function assignSite() {
    setError("");
    setMessage("");
    setAssigning(true);
    try {
      const response = await fetch(`/api/employees/${params.id}/site-assignment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: assignSiteId, shiftPattern: assignShift }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Unable to assign employee");
      setMessage("Employee site assignment updated.");
      const employeeResponse = await fetch(`/api/employees/${params.id}`);
      const employeePayload = await employeeResponse.json();
      if (employeeResponse.ok) setEmployee(employeePayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to assign employee");
    } finally {
      setAssigning(false);
    }
  }

  async function resubmitForApproval() {
    setResubmitFeedback("");
    setResubmitting(true);
    try {
      const response = await fetch(`/api/employees/${params.id}/resubmit-approval`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Unable to resubmit");
      setResubmitFeedback("Sent back to Ops for approval.");
      const employeeResponse = await fetch(`/api/employees/${params.id}`);
      const employeePayload = await employeeResponse.json();
      if (employeeResponse.ok) setEmployee(employeePayload);
    } catch (e) {
      setResubmitFeedback(e instanceof Error ? e.message : "Unable to resubmit");
    } finally {
      setResubmitting(false);
    }
  }

  if (error) return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>;
  if (!employee) return <p className="text-sm text-slate-500">Loading employee profile...</p>;
  const isArchived = employee.status === "EXITED";

  return (
    <div className="space-y-4">
      <PageHeader title={employee.fullName} subtitle={`${employee.employeeId} • ${employee.jobTitle}`} />
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Status" value={employee.status} />
        <StatCard label="Department" value={employee.department} />
        <StatCard label="Onboarding Stage" value={employee.onboardingStage} />
        <StatCard label="Salary" value={employee.payrollConfig?.basicSalary ? `AED ${employee.payrollConfig.basicSalary}` : "N/A"} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border p-3">
          <h3 className="mb-2 text-sm font-semibold">Identity & Assignment</h3>
          <p className="text-sm">Nationality: {employee.nationality}</p>
          <p className="text-sm">Mobile: {employee.mobile}</p>
          <p className="text-sm">Site: {employee.siteAssignment?.site?.name ?? "Unassigned"}</p>
        </div>
        <div className="rounded border p-3">
          <h3 className="mb-2 text-sm font-semibold">Workflow Status</h3>
          <p className="text-sm">Approval: {employee.approval?.status ?? "N/A"}</p>
          <p className="text-sm">Approval Note: {employee.approval?.note ?? "None"}</p>
          <p className="text-sm">Documents uploaded: {employee.documents?.length ?? 0}</p>
        </div>
      </div>
      {isArchived ? (
        <div className="rounded border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
          Employee is archived (EXITED). Assignment and workflow mutation actions are disabled.
        </div>
      ) : null}

      {role === "HR_ADMIN" && employee.status === "CONDITIONALLY_APPROVED" ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3">
          <h3 className="mb-2 text-sm font-semibold text-amber-950">Ops requested changes</h3>
          <p className="mb-2 text-sm text-amber-900">
            {employee.approval?.note ? <>Remark: {employee.approval.note}</> : <>Update documents or payroll as needed, then resubmit.</>}
          </p>
          <button
            type="button"
            disabled={resubmitting}
            className="rounded bg-amber-700 px-3 py-2 text-sm text-white disabled:opacity-60"
            onClick={resubmitForApproval}
          >
            {resubmitting ? "Submitting..." : "Resubmit for approval"}
          </button>
          {resubmitFeedback ? (
            <p className={`mt-2 text-sm ${resubmitFeedback.includes("Sent back") ? "text-emerald-800" : "text-rose-700"}`}>{resubmitFeedback}</p>
          ) : null}
        </div>
      ) : null}

      {role === "OPS_DIRECTOR" ? (
        <div className="rounded border p-3">
          <h3 className="mb-2 text-sm font-semibold">Ops Assignment</h3>
          <p className="mb-2 text-xs text-slate-500">Assign active employees to a site and shift pattern.</p>
          {employee.status !== "ACTIVE" ? (
            <p className="text-sm text-amber-800">Site assignment is available after the employee is approved (Active).</p>
          ) : (
            <>
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <select className="rounded border p-2 text-sm" value={assignSiteId} onChange={(e) => setAssignSiteId(e.target.value)}>
                  <option value="">Select site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name} ({site.location})
                    </option>
                  ))}
                </select>
                <select className="rounded border p-2 text-sm" value={assignShift} onChange={(e) => setAssignShift(e.target.value)}>
                  <option value="MORNING">Morning</option>
                  <option value="EVENING">Evening</option>
                  <option value="NIGHT">Night</option>
                  <option value="ROTATING">Rotating</option>
                </select>
                <button disabled={assigning || isArchived} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60" onClick={assignSite}>
                  {assigning ? "Saving..." : "Assign"}
                </button>
              </div>
            </>
          )}
          {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href={`/employees/${employee.id}/documents`} className="rounded border px-3 py-2 text-sm hover:bg-slate-50">Documents</Link>
        <Link
          href={`/employees/${employee.id}/hours`}
          className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-slate-50"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
          Hours calendar
        </Link>
        <Link href={`/employees/${employee.id}/payroll`} className="rounded border px-3 py-2 text-sm hover:bg-slate-50">Payroll</Link>
        <Link href={`/employees/${employee.id}/exit`} className="rounded border px-3 py-2 text-sm hover:bg-slate-50">Offboarding</Link>
      </div>
    </div>
  );
}
