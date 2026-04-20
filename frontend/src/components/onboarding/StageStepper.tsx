import { BadgeCheck, BriefcaseBusiness, CircleCheckBig, FileText, ShieldCheck, UserRound } from "lucide-react";

const steps = [
  { label: "Personal", icon: UserRound },
  { label: "Employment", icon: BriefcaseBusiness },
  { label: "Documents", icon: FileText },
  { label: "Payroll", icon: BadgeCheck },
  { label: "Approval", icon: ShieldCheck },
  { label: "Confirmation", icon: CircleCheckBig },
];

export function StageStepper({
  stage,
  maxReachedStage,
  onStepClick,
}: {
  stage: number;
  maxReachedStage: number;
  onStepClick: (nextStage: number) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-600">Onboarding Progress</p>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
        {steps.map(({ label, icon: Icon }, index) => {
          const number = index + 1;
          const active = number === stage;
          const complete = number < stage;
          const allowed = number <= maxReachedStage;
          return (
            <button
              type="button"
              key={label}
              onClick={() => onStepClick(number)}
              disabled={!allowed}
              className={`group rounded-2xl border px-3 py-2 text-left transition duration-200 ${
                active
                  ? "border-[#3B82F6] bg-blue-50 shadow-sm"
                  : complete
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-200 bg-white"
              } ${allowed ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm" : "cursor-not-allowed opacity-60"}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                    active
                      ? "bg-[#3B82F6] text-white"
                      : complete
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {number}
                </span>
                <Icon className={`h-4 w-4 ${active ? "text-[#3B82F6]" : complete ? "text-emerald-600" : "text-slate-500"}`} />
              </div>
              <p className="mt-1 font-medium text-slate-700">{label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
