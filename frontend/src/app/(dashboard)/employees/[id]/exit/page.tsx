"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AccessDenied } from "@/src/components/layout/AccessDenied";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { canAccessPage } from "@/src/lib/permissions";
import type { AppRole } from "@/src/lib/roles";

type Employee = { id: string; fullName: string; status: string };
type ExitRecord = { id: string; exitStatus: string; lastWorkingDay?: string };

export default function Page() {
  const params = useParams<{ id: string }>();
  const { data: session, status: sessionStatus } = useSession();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [reason, setReason] = useState("RESIGNATION");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [record, setRecord] = useState<ExitRecord | null>(null);
  const [message, setMessage] = useState("");
  const [blockers, setBlockers] = useState<string[]>([]);
  const role = (session?.user as { role?: AppRole } | undefined)?.role;
  const hasPageAccess = canAccessPage("/employees/[id]/exit", role);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !hasPageAccess) return;
    fetch(`/api/employees/${params.id}`)
      .then((r) => r.json())
      .then(setEmployee)
      .catch(() => setMessage("Unable to load employee"));
  }, [hasPageAccess, params.id, sessionStatus]);

  async function initiateExit() {
    const response = await fetch("/api/exit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: params.id,
        reason,
        raisedBy: "HR",
        lastWorkingDay: lastWorkingDay || new Date().toISOString(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const nextBlockers = Array.isArray(payload?.blockers)
        ? payload.blockers.map((b: { message?: string }) => b?.message ?? "Validation blocker")
        : [];
      setBlockers(nextBlockers);
      setMessage(payload?.message ?? payload?.error ?? "Unable to start offboarding");
      return;
    }
    setBlockers([]);
    setRecord(payload);
    setMessage("Offboarding case created successfully.");
  }

  if (sessionStatus === "loading") return <p className="text-sm text-slate-500">Loading...</p>;
  if (!hasPageAccess) return <AccessDenied message="HR role is required to start offboarding." />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${employee?.fullName ?? "Employee"} — Offboarding`}
        subtitle="Capture reason and last working day, then start the offboarding case."
      />
      <div className="grid gap-2 rounded border p-3 md:grid-cols-3">
        <select className="rounded border p-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="RESIGNATION">Resignation</option>
          <option value="TERMINATION">Termination</option>
          <option value="CONTRACT_END">Contract End</option>
          <option value="RETIREMENT">Retirement</option>
        </select>
        <input className="rounded border p-2 text-sm" type="date" value={lastWorkingDay} onChange={(e) => setLastWorkingDay(e.target.value)} />
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={initiateExit}>
          Start offboarding
        </button>
      </div>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      {blockers.length > 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          {blockers.map((b) => (
            <div key={b}>- {b}</div>
          ))}
        </div>
      ) : null}
      {record ? (
        <Link href={`/exit/${record.id}`} className="inline-block rounded border px-3 py-2 text-sm text-blue-700 hover:bg-slate-50">
          Open offboarding case
        </Link>
      ) : null}
    </div>
  );
}
