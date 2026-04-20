"use client";

import { useEffect, useState } from "react";
import { ClearanceChecklist, type ClearanceState } from "@/src/components/exit/ClearanceChecklist";
import { SettlementBreakdown } from "@/src/components/exit/SettlementBreakdown";
import { ExitDocuments } from "@/src/components/exit/ExitDocuments";

const defaultClearance: ClearanceState = {
  accessCardReturned: false,
  uniformReturned: false,
  assetListCleared: false,
  itAccessRevoked: false,
  financeCleared: false,
  hrInterviewDone: false,
};

export function ExitWizard({ exitId }: { exitId: string }) {
  const [clearance, setClearance] = useState<ClearanceState>(defaultClearance);
  const [settlement, setSettlement] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  const [exitStatus, setExitStatus] = useState<string>("");
  const [blockers, setBlockers] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/exit/${exitId}`)
      .then((r) => r.json())
      .then((payload) => {
        setExitStatus(payload.exitStatus ?? "");
        setClearance({
          accessCardReturned: Boolean(payload.accessCardReturned),
          uniformReturned: Boolean(payload.uniformReturned),
          assetListCleared: Boolean(payload.assetListCleared),
          itAccessRevoked: Boolean(payload.itAccessRevoked),
          financeCleared: Boolean(payload.financeCleared),
          hrInterviewDone: Boolean(payload.hrInterviewDone),
        });
        if (
          payload.gratuityAmount != null &&
          payload.gratuityDays != null &&
          payload.totalSettlement != null
        ) {
          setSettlement({
            finalGratuityDays: payload.gratuityDays,
            gratuityAmount: payload.gratuityAmount,
            leaveEncashment: payload.leaveEncashment ?? 0,
            finalMonthSalary: payload.finalMonthSalary ?? 0,
            otherDeductions: payload.otherDeductions ?? 0,
            totalSettlement: payload.totalSettlement,
          });
        }
      })
      .catch(() => {});
  }, [exitId]);

  async function persistClearance(next: ClearanceState) {
    if (exitStatus === "COMPLETED") return;
    await fetch(`/api/exit/${exitId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  async function computeSettlement() {
    const response = await fetch(`/api/exit/${exitId}/settlement`);
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload?.message ?? payload?.error ?? "Unable to compute settlement");
      return;
    }
    setSettlement(payload);
    setClearance((prev) => ({ ...prev, financeCleared: true, hrInterviewDone: true }));
    setMessage("Settlement computed and saved.");
  }

  async function completeExit() {
    const response = await fetch(`/api/exit/${exitId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "COMPLETE" }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const nextBlockers = Array.isArray(payload?.blockers)
        ? payload.blockers.map((b: { message?: string }) => b?.message ?? "Validation blocker")
        : [];
      setBlockers(nextBlockers);
      setMessage(payload?.message ?? payload?.error ?? "Unable to complete offboarding");
      return;
    }
    setBlockers([]);
    setExitStatus("COMPLETED");
    setMessage("Offboarding completed.");
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Offboarding workflow</h2>
      <div className="rounded border p-3">
        <h3 className="mb-2 font-medium">Step 1: Clearance Checklist</h3>
        <ClearanceChecklist
          value={clearance}
          onToggle={(field) => {
            if (exitStatus === "COMPLETED") return;
            const next = { ...clearance, [field]: !clearance[field] };
            setClearance(next);
            persistClearance(next).catch(() => setMessage("Unable to save checklist"));
          }}
        />
      </div>

      <div className="rounded border p-3">
        <h3 className="mb-2 font-medium">Step 2: Settlement</h3>
        <button
          className="mb-3 rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={computeSettlement}
          disabled={exitStatus === "COMPLETED"}
        >
          Calculate Settlement
        </button>
        <SettlementBreakdown settlement={settlement} />
      </div>

      <div className="rounded border p-3">
        <h3 className="mb-2 font-medium">Step 3: Offboarding documents</h3>
        <ExitDocuments exitId={exitId} />
      </div>

      <button
        className="rounded bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-60"
        onClick={completeExit}
        disabled={exitStatus === "COMPLETED"}
      >
        Complete offboarding
      </button>
      {exitStatus === "COMPLETED" ? <p className="text-sm text-emerald-700">Employee is archived (EXITED). This record is now read-only.</p> : null}
      {blockers.length > 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          {blockers.map((b) => (
            <div key={b}>- {b}</div>
          ))}
        </div>
      ) : null}
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}
