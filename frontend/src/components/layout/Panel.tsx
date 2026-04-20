export function Panel({
  title,
  action,
  className = "",
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">{message}</p>;
}
