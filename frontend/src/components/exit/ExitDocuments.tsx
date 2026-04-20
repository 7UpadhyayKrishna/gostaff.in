"use client";

import { useState } from "react";

function downloadText(filename: string, body: string) {
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatMoney(n: number) {
  return `AED ${n.toFixed(2)}`;
}

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

type ExitPayload = {
  employee?: { fullName?: string; employeeId?: string; jobTitle?: string; department?: string };
  lastWorkingDay?: string;
  exitReason?: string;
  initiatedAt?: string;
  totalSettlement?: number | null;
  gratuityAmount?: number | null;
  gratuityDays?: number | null;
  leaveEncashment?: number | null;
  finalMonthSalary?: number | null;
  otherDeductions?: number | null;
  accessCardReturned?: boolean;
  uniformReturned?: boolean;
  assetListCleared?: boolean;
  itAccessRevoked?: boolean;
  financeCleared?: boolean;
  hrInterviewDone?: boolean;
};

export function ExitDocuments({ exitId }: { exitId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadExit(): Promise<ExitPayload> {
    const r = await fetch(`/api/exit/${exitId}`);
    const data = (await r.json()) as ExitPayload & { error?: string };
    if (!r.ok) throw new Error(typeof data?.error === "string" ? data.error : "Unable to load exit record");
    return data;
  }

  async function run(kind: string, fn: (data: ExitPayload) => void) {
    setError("");
    setBusy(kind);
    try {
      const data = await loadExit();
      fn(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-2 text-sm">
      <button
        type="button"
        disabled={busy !== null}
        className="rounded border border-slate-200 bg-white px-3 py-2 text-left font-medium text-blue-700 transition hover:bg-slate-50 disabled:opacity-50"
        onClick={() =>
          run("letter", (data) => {
            const name = data.employee?.fullName ?? "Employee";
            const id = data.employee?.employeeId ?? "—";
            const total = Number(data.totalSettlement ?? 0);
            const gratuity = Number(data.gratuityAmount ?? 0);
            const leave = Number(data.leaveEncashment ?? 0);
            const finalMonth = Number(data.finalMonthSalary ?? 0);
            const other = Number(data.otherDeductions ?? 0);
            const body = [
              "SETTLEMENT SUMMARY (draft document)",
              "",
              `Date: ${new Date().toLocaleDateString()}`,
              `Employee: ${name}`,
              `Employee ID: ${id}`,
              `Last working day: ${formatDate(data.lastWorkingDay)}`,
              `Exit reason: ${data.exitReason ?? "—"}`,
              "",
              "Figures",
              `  Gratuity: ${formatMoney(gratuity)}`,
              `  Leave encashment: ${formatMoney(leave)}`,
              `  Final month salary: ${formatMoney(finalMonth)}`,
              `  Other deductions: ${formatMoney(other)}`,
              `  Total settlement: ${formatMoney(total)}`,
              "",
              "This file is generated for HR records. Adapt to your company letterhead and legal review.",
            ].join("\n");
            downloadText(`settlement-summary-${id.replace(/[^a-zA-Z0-9-_]/g, "_")}.txt`, body);
          })
        }
      >
        {busy === "letter" ? "Generating…" : "Generate Settlement Letter"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        className="rounded border border-slate-200 bg-white px-3 py-2 text-left font-medium text-blue-700 transition hover:bg-slate-50 disabled:opacity-50"
        onClick={() =>
          run("exp", (data) => {
            const name = data.employee?.fullName ?? "Employee";
            const id = data.employee?.employeeId ?? "—";
            const role = data.employee?.jobTitle?.replace(/_/g, " ") ?? "their role on file";
            const dept = data.employee?.department?.replace(/_/g, " ");
            const deptPhrase =
              dept && dept !== "—" ? ` in the ${dept} department` : "";
            const body = [
              "TO WHOM IT MAY CONCERN",
              "",
              "Experience certificate (draft)",
              "",
              `This is to certify that ${name} (ID: ${id}) was employed with us`,
              `in the capacity of ${role}${deptPhrase}, until ${formatDate(data.lastWorkingDay)}.`,
              "",
              "During their tenure they carried out their assigned duties to our satisfaction.",
              "",
              "Issued for employment verification purposes.",
              "",
              `Date: ${new Date().toLocaleDateString()}`,
              "",
              "_________________________",
              "Authorized signatory",
            ].join("\n");
            downloadText(`experience-certificate-${id.replace(/[^a-zA-Z0-9-_]/g, "_")}.txt`, body);
          })
        }
      >
        {busy === "exp" ? "Generating…" : "Generate Experience Certificate"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        className="rounded border border-slate-200 bg-white px-3 py-2 text-left font-medium text-blue-700 transition hover:bg-slate-50 disabled:opacity-50"
        onClick={() =>
          run("payslip", (data) => {
            const name = data.employee?.fullName ?? "Employee";
            const id = data.employee?.employeeId ?? "—";
            const total = Number(data.totalSettlement ?? 0);
            const finalMonth = Number(data.finalMonthSalary ?? 0);
            const body = [
              "FINAL PAY / SETTLEMENT SLIP (draft)",
              "",
              `Employee: ${name}`,
              `Employee ID: ${id}`,
              `Period reference: exit as of ${formatDate(data.lastWorkingDay)}`,
              "",
              "Amounts aligned with exit settlement",
              `  Final month salary component: ${formatMoney(finalMonth)}`,
              `  Total settlement (incl. gratuity & leave per exit record): ${formatMoney(total)}`,
              "",
              "Note: Official payslips are produced from Payroll runs. Use this as a working summary during offboarding.",
            ].join("\n");
            downloadText(`final-pay-summary-${id.replace(/[^a-zA-Z0-9-_]/g, "_")}.txt`, body);
          })
        }
      >
        {busy === "payslip" ? "Preparing…" : "Download Final Payslip"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        className="rounded border border-slate-200 bg-white px-3 py-2 text-left font-medium text-blue-700 transition hover:bg-slate-50 disabled:opacity-50"
        onClick={() =>
          run("clearance", (data) => {
            const name = data.employee?.fullName ?? "Employee";
            const id = data.employee?.employeeId ?? "—";
            const rows = [
              ["Equipment / access card returned", data.accessCardReturned],
              ["Uniform returned", data.uniformReturned],
              ["Documents / assets handover", data.assetListCleared],
              ["IT access revoked", data.itAccessRevoked],
              ["Finance / final salary clearance", data.financeCleared],
              ["HR closure / gratuity confirmation", data.hrInterviewDone],
            ] as const;
            const body = [
              "CLEARANCE CONFIRMATION (draft)",
              "",
              `Employee: ${name}`,
              `Employee ID: ${id}`,
              `Exit initiated: ${formatDate(data.initiatedAt)}`,
              "",
              "Checklist status",
              ...rows.map(([label, ok]) => `  [${ok ? "x" : " "}] ${label}`),
              "",
              `Generated: ${new Date().toLocaleString()}`,
            ].join("\n");
            downloadText(`clearance-confirmation-${id.replace(/[^a-zA-Z0-9-_]/g, "_")}.txt`, body);
          })
        }
      >
        {busy === "clearance" ? "Generating…" : "Clearance Confirmation"}
      </button>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
