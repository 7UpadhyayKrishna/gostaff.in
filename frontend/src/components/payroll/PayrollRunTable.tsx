import Link from "next/link";

type PayrollRun = {
  id: string;
  month: string;
  status: string;
  totalEmployees: number;
  totalGross: number;
  totalNet: number;
};

export function PayrollRunTable({ runs }: { runs: PayrollRun[] }) {
  if (!runs.length) return <div className="text-sm text-slate-500">No payroll runs yet.</div>;

  const statusTone = (status: string) => {
    if (status === "APPROVED") return "bg-emerald-100 text-emerald-800";
    if (status === "READY_FOR_APPROVAL") return "bg-blue-100 text-blue-800";
    if (status === "REJECTED") return "bg-rose-100 text-rose-800";
    if (status === "CLOSED") return "bg-slate-200 text-slate-800";
    return "bg-slate-100 text-slate-700";
  };

  const blocker = (run: PayrollRun) => {
    if (run.totalEmployees === 0) return "No active employees";
    if (run.status === "REJECTED") return "Rejected by Ops";
    if (run.status === "VALIDATING") return "Locked site check pending";
    if (run.status === "COLLECTING") return "Collecting site submissions";
    return "Ready";
  };

  return (
    <div className="overflow-hidden rounded border">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="p-2 text-left">Month</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Employees</th>
            <th className="p-2 text-left">Gross</th>
            <th className="p-2 text-left">Net</th>
            <th className="p-2 text-left">Blocked Reason</th>
            <th className="p-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t">
              <td className="p-2">{run.month}</td>
              <td className="p-2">
                <span className={`rounded px-2 py-1 text-xs font-medium ${statusTone(run.status)}`}>{run.status}</span>
              </td>
              <td className="p-2">{run.totalEmployees}</td>
              <td className="p-2">AED {run.totalGross.toFixed(2)}</td>
              <td className="p-2">AED {run.totalNet.toFixed(2)}</td>
              <td className="p-2 text-xs text-slate-600">{blocker(run)}</td>
              <td className="p-2"><Link href={`/payroll/${run.id}`} className="text-blue-600">Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
