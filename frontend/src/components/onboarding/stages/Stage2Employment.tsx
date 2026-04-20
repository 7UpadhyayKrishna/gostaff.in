import type { OnboardingData } from "@/src/hooks/useOnboardingForm";

export function Stage2Employment({ data, updateField }: { data: OnboardingData; updateField: <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => void; }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-600">Job title</label>
        <select
          className="w-full rounded border p-2"
          value={data.jobTitle}
          onChange={(e) => {
            const v = e.target.value;
            updateField("jobTitle", v);
            if (v !== "SUPERVISOR") {
              updateField("supervisorEmail", "");
              updateField("supervisorPassword", "");
            }
          }}
        >
          <option value="SECURITY_GUARD">Security Guard</option>
          <option value="CLEANER">Cleaner</option>
          <option value="SUPERVISOR">Supervisor</option>
          <option value="DRIVER">Driver</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Department</label>
        <select className="w-full rounded border p-2" value={data.department} onChange={(e) => updateField("department", e.target.value)}>
          <option value="OPERATIONS">Operations</option>
          <option value="FACILITIES">Facilities</option>
        </select>
      </div>
      <select
        className="rounded border p-2"
        value={data.contractType}
        onChange={(e) => {
          const nextType = e.target.value;
          updateField("contractType", nextType);
          if (nextType === "UNLIMITED") {
            updateField("contractEnd", "");
          }
        }}
      >
        <option value="LIMITED">Limited</option>
        <option value="UNLIMITED">Unlimited</option>
      </select>
      <input className="rounded border p-2" type="date" value={data.contractStart} onChange={(e) => updateField("contractStart", e.target.value)} />
      {data.contractType === "LIMITED" ? (
        <input
          className="rounded border p-2"
          type="date"
          value={data.contractEnd}
          onChange={(e) => updateField("contractEnd", e.target.value)}
          placeholder="Contract expiry date"
        />
      ) : null}

      {data.jobTitle === "SUPERVISOR" ? (
        <div className="md:col-span-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-sm font-semibold text-slate-800">Supervisor portal login</p>
          <p className="text-xs text-slate-600">
            These credentials are used to sign in to the supervisor dashboard. They are applied when you submit this onboarding for approval.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="supervisor-email">
                Email
              </label>
              <input
                id="supervisor-email"
                className="w-full rounded border p-2 text-sm"
                type="email"
                autoComplete="off"
                placeholder="supervisor@company.com"
                value={data.supervisorEmail}
                onChange={(e) => updateField("supervisorEmail", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="supervisor-password">
                Password
              </label>
              <input
                id="supervisor-password"
                className="w-full rounded border p-2 text-sm"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                value={data.supervisorPassword}
                onChange={(e) => updateField("supervisorPassword", e.target.value)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
