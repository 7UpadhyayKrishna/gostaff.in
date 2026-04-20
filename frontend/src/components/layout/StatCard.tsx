type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  actionLabel?: string;
  tone?: "default" | "warning" | "success";
};

const toneClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "border-slate-200 bg-white",
  warning: "border-amber-200 bg-amber-50/50",
  success: "border-emerald-200 bg-emerald-50/50",
};

export function StatCard({ label, value, hint, actionLabel, tone = "default" }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-3 ${toneClass[tone]}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
      {actionLabel ? (
        <button type="button" className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
