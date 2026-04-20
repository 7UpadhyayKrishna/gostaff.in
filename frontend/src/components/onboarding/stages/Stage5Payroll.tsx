import type { OnboardingData } from "@/src/hooks/useOnboardingForm";
import { SalaryPreviewCard } from "@/src/components/onboarding/SalaryPreviewCard";

export function Stage5Payroll({ data, updateField }: { data: OnboardingData; updateField: <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => void; }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <input className="rounded border p-2" type="number" value={data.basicSalary} onChange={(e) => updateField("basicSalary", Number(e.target.value))} placeholder="Basic Salary" />
        <input className="rounded border p-2" type="number" value={data.housingAllowance} onChange={(e) => updateField("housingAllowance", Number(e.target.value))} placeholder="Housing" />
        <input className="rounded border p-2" type="number" value={data.transportAllowance} onChange={(e) => updateField("transportAllowance", Number(e.target.value))} placeholder="Transport" />
        <input className="rounded border p-2" value={data.bankName} onChange={(e) => updateField("bankName", e.target.value)} placeholder="Bank name" />
        <input className="rounded border p-2 md:col-span-2" value={data.iban} onChange={(e) => updateField("iban", e.target.value)} placeholder="IBAN" />
      </div>
      <SalaryPreviewCard basic={data.basicSalary} housing={data.housingAllowance} transport={data.transportAllowance} />
    </div>
  );
}
