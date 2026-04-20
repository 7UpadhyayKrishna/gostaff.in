"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Stage1Personal } from "@/src/components/onboarding/stages/Stage1Personal";
import { Stage2Employment } from "@/src/components/onboarding/stages/Stage2Employment";
import { Stage3Documents } from "@/src/components/onboarding/stages/Stage3Documents";
import { Stage5Payroll } from "@/src/components/onboarding/stages/Stage5Payroll";
import { Stage6Approval } from "@/src/components/onboarding/stages/Stage6Approval";
import { Stage7Confirmation } from "@/src/components/onboarding/stages/Stage7Confirmation";
import { StageStepper } from "@/src/components/onboarding/StageStepper";
import { useOnboardingForm } from "@/src/hooks/useOnboardingForm";
import { mapEmployeeDraftToOnboardingData } from "@/src/lib/mapEmployeeDraftToOnboardingData";
import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

async function assertPassportAndEidReady(employeeId: string) {
  const response = await fetch(`/api/employees/${employeeId}/documents`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error ?? "Unable to verify documents");
  const docs = Array.isArray(payload) ? payload : [];
  const ready = (type: string) =>
    docs.some(
      (d: { type: string; fileUrl?: string | null; uploadDeferredRemark?: string | null }) =>
        d.type === type &&
        ((d.fileUrl != null && String(d.fileUrl).trim().length > 0) ||
          (d.uploadDeferredRemark != null && String(d.uploadDeferredRemark).trim().length > 0)),
    );
  if (!ready("PASSPORT") || !ready("EMIRATES_ID")) {
    throw new Error(
      "For passport and Emirates ID, upload each file or use “upload later” with a remark, then continue.",
    );
  }
}

export function OnboardingWizard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const resumeParam = searchParams.get("resume");
  const { stage, setStage, draftId, setDraftId, data, setData, payloadData, updateField, canContinue, stageErrors } =
    useOnboardingForm();
  const [loading, setLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [maxReachedStage, setMaxReachedStage] = useState(1);

  useEffect(() => {
    if (!resumeParam) return;
    if (draftId === resumeParam) {
      router.replace("/employees/onboard", { scroll: false });
      return;
    }
    let cancelled = false;
    setResumeLoading(true);
    setMessage("");
    void (async () => {
      try {
        const res = await fetch(`/api/onboarding/${resumeParam}`);
        const emp = await res.json();
        if (!res.ok) throw new Error(emp?.error ?? emp?.message ?? "Unable to load draft");
        if (emp.status !== "DRAFT") {
          throw new Error("Resume is only available for employees in Draft status.");
        }
        if (cancelled) return;
        setData(mapEmployeeDraftToOnboardingData(emp));
        setDraftId(emp.id as string);
        const st = Math.min(6, Math.max(1, Number(emp.onboardingStage) || 1));
        setStage(st);
        setMaxReachedStage(Math.max(st, 1));
        setMessage("Draft loaded — continue where you left off.");
        router.replace("/employees/onboard", { scroll: false });
      } catch (e) {
        if (!cancelled) {
          setMessage(e instanceof Error ? e.message : "Unable to resume onboarding");
          router.replace("/employees/onboard", { scroll: false });
        }
      } finally {
        if (!cancelled) setResumeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumeParam, draftId, router, setData, setDraftId, setStage]);

  const StageComponent = useMemo(() => {
    const commonProps = { data, updateField };
    switch (stage) {
      case 1:
        return <Stage1Personal {...commonProps} />;
      case 2:
        return <Stage2Employment {...commonProps} />;
      case 3:
        return (
          <Stage3Documents
            {...commonProps}
            draftId={draftId}
            onStatus={(nextMessage) => {
              setMessage(nextMessage);
            }}
          />
        );
      case 4:
        return <Stage5Payroll {...commonProps} />;
      case 5:
        return <Stage6Approval {...commonProps} />;
      case 6:
        return <Stage7Confirmation />;
      default:
        return <Stage7Confirmation />;
    }
  }, [data, draftId, stage, updateField]);

  async function persistStage(nextStage: number) {
    setLoading(true);
    setMessage("");
    try {
      let targetDraftId = draftId;

      if (!targetDraftId) {
        const start = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadData),
        });
        const startPayload = await start.json();
        if (!start.ok) throw new Error(startPayload?.error ?? "Unable to start onboarding");
        targetDraftId = startPayload.draftId as string;
        setDraftId(targetDraftId);
      }

      if (nextStage === 6 && payloadData.jobTitle === "SUPERVISOR") {
        const email = payloadData.supervisorEmail.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error("Enter a valid supervisor portal email before submitting.");
        }
        if (payloadData.supervisorPassword.length < 6) {
          throw new Error("Supervisor portal password must be at least 6 characters before submitting.");
        }
      }

      if (nextStage === 6) {
        await assertPassportAndEidReady(targetDraftId!);
      }

      const update = await fetch(`/api/onboarding/${targetDraftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: nextStage,
          data: {
            ...payloadData,
            ...(nextStage < 6 ? { supervisorPassword: "" } : {}),
            payroll: payloadData,
          },
        }),
      });
      const updatePayload = await update.json();
      if (!update.ok) throw new Error(updatePayload?.error ?? "Unable to save stage");

      setMessage(nextStage === 6 ? "Submitted for Ops approval." : `Stage ${nextStage} saved.`);
      setLastSavedAt(new Date().toISOString());
      setMaxReachedStage((prev) => Math.max(prev, nextStage));
      setStage(nextStage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save stage");
    } finally {
      setLoading(false);
    }
  }

  function jumpToStage(nextStage: number) {
    if (nextStage === stage) return;
    if (nextStage < stage) {
      setStage(nextStage);
      return;
    }
    if (nextStage <= maxReachedStage) {
      setStage(nextStage);
    }
  }

  const readinessRows = [
    { key: "Identity", ready: Boolean(data.firstName && data.lastName), pending: "Missing first/last name" },
    {
      key: "Employment",
      ready: Boolean(
        data.department &&
          data.contractType &&
          (data.jobTitle !== "SUPERVISOR" ||
            (data.supervisorEmail.trim() &&
              /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.supervisorEmail.trim()) &&
              data.supervisorPassword.length >= 6)),
      ),
      pending: "Pending role, contract, or supervisor login details",
    },
    { key: "Documents", ready: Boolean(data.passportNumber && data.emiratesIdNumber), pending: "Pending or partially captured" },
    { key: "Payroll", ready: Boolean(data.basicSalary && data.bankName), pending: "Pending salary/bank setup" },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="rounded-3xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#0F172A] md:text-2xl">Onboarding Wizard</h2>
            <p className="mt-1 text-sm text-slate-500">
              {draftId
                ? "Continue this draft, or start a new employee from the directory when you are done."
                : "Create a complete employee profile in 6 guided steps."}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-slate-600">
            <Clock3 className="h-3.5 w-3.5" />
            {lastSavedAt ? `Last saved: ${new Date(lastSavedAt).toLocaleString()}` : "Not saved yet"}
          </span>
        </div>
      </div>

      {resumeLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-slate-700">Loading draft…</div>
      ) : null}

      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
        <StageStepper stage={stage} maxReachedStage={Math.max(maxReachedStage, stage)} onStepClick={jumpToStage} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-6">{StageComponent}</section>
        <aside className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
          <h3 className="text-sm font-semibold tracking-wide text-[#0F172A]">Readiness Summary</h3>
          <div className="space-y-2">
            {readinessRows.map((row) => (
              <div key={row.key} className="flex items-start gap-2 rounded-xl bg-[#F8FAFC] px-3 py-2">
                {row.ready ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                )}
                <div className="text-xs">
                  <p className="font-semibold text-slate-700">{row.key}</p>
                  <p className={row.ready ? "text-emerald-700" : "text-amber-700"}>{row.ready ? "Ready" : row.pending}</p>
                </div>
              </div>
            ))}
          </div>
          {!canContinue ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
              <p className="mb-1 text-xs font-semibold text-amber-700">Validation map</p>
              <ul className="list-inside list-disc text-xs text-amber-800 leading-5">
                {stageErrors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3 text-xs text-slate-600">
            <div className="mb-1 flex items-center gap-1 text-[#0F172A]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <p className="font-semibold">Ops handover note</p>
            </div>
            Site assignment is done by Ops after approval. Submitting on the Approval step sends the record to the Ops queue.
          </div>
        </aside>
      </div>

      {!canContinue && stage < 6 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Complete required fields before continuing ({stageErrors.join(", ")}).
        </div>
      ) : null}

      {message ? <div className="text-sm text-slate-600">{message}</div> : null}

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50 disabled:opacity-50"
          disabled={loading || resumeLoading || stage === 1}
          onClick={() => setStage(stage - 1)}
        >
          Back
        </button>
        <button
          className="rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-500 disabled:opacity-50"
          disabled={loading || resumeLoading || stage === 6 || !canContinue}
          onClick={() => persistStage(stage + 1)}
        >
          {loading ? "Saving..." : stage === 5 ? "Submit to Approval" : "Save & Next"}
        </button>
      </div>
    </div>
  );
}
