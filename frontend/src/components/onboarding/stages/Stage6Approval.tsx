import type { OnboardingData } from "@/src/hooks/useOnboardingForm";

export function Stage6Approval({ data, updateField }: { data: OnboardingData; updateField: <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => void; }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Ops will review this onboarding next. After approval, Ops assigns the employee to a site; the site supervisor then handles timesheets.
      </p>
      <textarea className="min-h-24 w-full rounded border p-2" placeholder="Optional note for Ops" value={data.approvalNote} onChange={(e) => updateField("approvalNote", e.target.value)} />
    </div>
  );
}
