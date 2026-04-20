export function AccessDenied({ message }: { message: string }) {
  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      {message}
    </div>
  );
}
