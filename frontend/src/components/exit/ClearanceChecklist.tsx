export type ClearanceState = {
  accessCardReturned: boolean;
  uniformReturned: boolean;
  assetListCleared: boolean;
  itAccessRevoked: boolean;
  financeCleared: boolean;
  hrInterviewDone: boolean;
};

const labels: Array<[keyof ClearanceState, string]> = [
  ["accessCardReturned", "Equipment returned"],
  ["uniformReturned", "Uniform returned"],
  ["assetListCleared", "Documents returned to employee"],
  ["itAccessRevoked", "IT access revoked"],
  ["financeCleared", "Final salary confirmed"],
  ["hrInterviewDone", "Gratuity calculated and confirmed"],
];

export function ClearanceChecklist({ value, onToggle }: { value: ClearanceState; onToggle: (field: keyof ClearanceState) => void }) {
  return (
    <div className="grid gap-2">
      {labels.map(([field, label]) => (
        <label key={field} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value[field]} onChange={() => onToggle(field)} />
          {label}
        </label>
      ))}
    </div>
  );
}
