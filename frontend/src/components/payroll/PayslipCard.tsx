import { WPSStatus } from "@/src/components/payroll/WPSStatus";

export function PayslipCard({
  payslip,
}: {
  payslip: { id: string; month: string; netSalary: number; grossSalary: number; employee?: { fullName?: string }; wpsStatus: string };
}) {
  return (
    <div className="rounded border p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="font-medium">{payslip.employee?.fullName ?? "Employee"}</p>
        <WPSStatus status={payslip.wpsStatus} />
      </div>
      <p className="text-sm text-slate-600">Month: {payslip.month}</p>
      <p className="text-sm text-slate-600">Gross: AED {payslip.grossSalary.toFixed(2)}</p>
      <p className="text-sm font-semibold">Net: AED {payslip.netSalary.toFixed(2)}</p>
    </div>
  );
}
