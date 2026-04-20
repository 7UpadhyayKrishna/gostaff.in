"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AccessDenied } from "@/src/components/layout/AccessDenied";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { StatCard } from "@/src/components/layout/StatCard";
import { canAccessPage } from "@/src/lib/permissions";
import type { AppRole } from "@/src/lib/roles";

type EmployeeDetail = {
  id: string;
  fullName: string;
  payrollConfig?: {
    basicSalary?: number;
    housingAllowance?: number;
    transportAllowance?: number;
    paymentMethod?: string;
    firstPayrollMonth?: string;
  } | null;
};

type PayrollRun = { id: string; month: string; status: string; totalEmployees: number };

export default function Page() {
  const params = useParams<{ id: string }>();
  const { data: session, status: sessionStatus } = useSession();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [error, setError] = useState("");
  const role = (session?.user as { role?: AppRole } | undefined)?.role;
  const hasPageAccess = canAccessPage("/employees/[id]/payroll", role);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !hasPageAccess) return;
    Promise.all([fetch(`/api/employees/${params.id}`), fetch("/api/payroll")])
      .then(async ([employeeRes, runsRes]) => {
        const employeePayload = await employeeRes.json();
        const runsPayload = await runsRes.json();
        if (!employeeRes.ok) throw new Error(employeePayload?.error ?? "Unable to load employee payroll profile");
        if (!runsRes.ok) throw new Error(runsPayload?.error ?? "Unable to load payroll runs");
        setEmployee(employeePayload);
        setRuns(Array.isArray(runsPayload) ? runsPayload : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load payroll profile"));
  }, [hasPageAccess, params.id, sessionStatus]);

  if (sessionStatus === "loading") return <p className="text-sm text-slate-500">Loading payroll profile...</p>;
  if (!hasPageAccess) return <AccessDenied message="You do not have access to this payroll profile." />;

  if (error) return <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>;
  if (!employee) return <p className="text-sm text-slate-500">Loading payroll profile...</p>;

  const payroll = employee.payrollConfig;
  const gross = Number(payroll?.basicSalary ?? 0) + Number(payroll?.housingAllowance ?? 0) + Number(payroll?.transportAllowance ?? 0);

  return (
    <div className="space-y-4">
      <PageHeader title={`${employee.fullName} Payroll`} subtitle="Compensation baseline and linked payroll runs." />
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Basic Salary" value={payroll?.basicSalary ? `AED ${payroll.basicSalary}` : "N/A"} />
        <StatCard label="Allowances" value={`AED ${Number(payroll?.housingAllowance ?? 0) + Number(payroll?.transportAllowance ?? 0)}`} />
        <StatCard label="Est. Gross" value={`AED ${gross}`} />
        <StatCard label="Payment Method" value={payroll?.paymentMethod ?? "N/A"} />
      </div>

      <div className="rounded border p-3">
        <h3 className="mb-2 text-sm font-semibold">Run history</h3>
        <div className="space-y-2">
          {runs.map((run) => (
            <div key={run.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{run.month}</p>
                <p className="text-xs text-slate-500">Status: {run.status}</p>
              </div>
              <Link href={`/payroll/${run.id}`} className="text-blue-600 hover:underline">
                Open run
              </Link>
            </div>
          ))}
          {runs.length === 0 ? <p className="text-sm text-slate-500">No payroll runs found yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
