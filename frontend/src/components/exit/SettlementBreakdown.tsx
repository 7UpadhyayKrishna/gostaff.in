export function SettlementBreakdown({ settlement }: { settlement: Record<string, unknown> | null }) {
  if (!settlement) return <div className="text-sm text-slate-500">Settlement not calculated yet.</div>;

  const gratuityDays = Number(settlement.finalGratuityDays ?? settlement.gratuityDays ?? 0);
  const gratuityAmount = Number(settlement.gratuityAmount ?? 0);
  const leaveEncashment = Number(settlement.leaveEncashment ?? 0);
  const finalMonthSalary = Number(settlement.finalMonthSalary ?? 0);
  const otherDeductions = Number(settlement.otherDeductions ?? 0);
  const totalSettlement = Number(settlement.totalSettlement ?? 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        <div className="rounded border p-2 text-sm">
          <p className="text-xs text-slate-500">Gratuity Days</p>
          <p className="font-semibold">{gratuityDays.toFixed(2)}</p>
        </div>
        <div className="rounded border p-2 text-sm">
          <p className="text-xs text-slate-500">Gratuity Amount</p>
          <p className="font-semibold">AED {gratuityAmount.toFixed(2)}</p>
        </div>
        <div className="rounded border p-2 text-sm">
          <p className="text-xs text-slate-500">Leave Encashment</p>
          <p className="font-semibold">AED {leaveEncashment.toFixed(2)}</p>
        </div>
      </div>
      <div className="rounded border p-3 text-sm">
        <p>Final Month Salary: <span className="font-semibold">AED {finalMonthSalary.toFixed(2)}</span></p>
        <p>Other Deductions: <span className="font-semibold">AED {otherDeductions.toFixed(2)}</span></p>
        <p className="mt-2 border-t pt-2 text-base font-semibold">Total Settlement: AED {totalSettlement.toFixed(2)}</p>
      </div>
      <details className="rounded border bg-slate-50 p-2 text-xs text-slate-600">
        <summary className="cursor-pointer font-medium">Formula transparency</summary>
        <p className="mt-1">Total = gratuity + leave encashment + final month salary - deductions</p>
      </details>
    </div>
  );
}
