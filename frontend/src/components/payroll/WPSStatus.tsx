export function WPSStatus({ status }: { status: string }) {
  const color = status === "SENT" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";
  return <span className={`rounded px-2 py-1 text-xs ${color}`}>WPS {status}</span>;
}
