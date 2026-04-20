import type { OnboardingData } from "@/src/hooks/useOnboardingForm";
import { COUNTRIES, PHONE_PREFIX_OPTIONS, PHONE_RULES, normalizeDigits } from "@/src/lib/countries";

export function Stage1Personal({ data, updateField }: { data: OnboardingData; updateField: <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => void; }) {
  const mobileRule = PHONE_RULES[data.mobilePrefix];
  const emergencyRule = PHONE_RULES[data.emergencyPhonePrefix];
  const baseFieldClass =
    "peer w-full rounded-xl border border-slate-200 bg-white px-3 pb-2 pt-5 text-sm text-slate-800 outline-none transition duration-200 placeholder:text-transparent focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20";
  const labelClass =
    "pointer-events-none absolute left-3 top-2 text-[11px] font-medium tracking-wide text-slate-500 transition peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:text-[#3B82F6]";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="relative">
          <input
            className={baseFieldClass}
            placeholder="First name"
            value={data.firstName}
            onChange={(e) => updateField("firstName", e.target.value)}
          />
          <label className={labelClass}>First name</label>
        </div>
        <div className="relative">
          <input
            className={baseFieldClass}
            placeholder="Middle name (optional)"
            value={data.middleName}
            onChange={(e) => updateField("middleName", e.target.value)}
          />
          <label className={labelClass}>Middle name (optional)</label>
        </div>
        <div className="relative">
          <input
            className={baseFieldClass}
            placeholder="Last name"
            value={data.lastName}
            onChange={(e) => updateField("lastName", e.target.value)}
          />
          <label className={labelClass}>Last name</label>
        </div>
        <div className="relative">
          <input
            className={baseFieldClass}
            list="country-list"
            placeholder="Nationality"
            value={data.nationality}
            onChange={(e) => updateField("nationality", e.target.value)}
          />
          <label className={labelClass}>Nationality</label>
        </div>
        <datalist id="country-list">
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.name} />
          ))}
        </datalist>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Primary Contact</p>
        <div className="grid gap-3 md:grid-cols-[170px_1fr]">
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
            value={data.mobilePrefix}
            onChange={(e) => updateField("mobilePrefix", e.target.value)}
          >
            {PHONE_PREFIX_OPTIONS.map((item) => (
              <option key={`${item.prefix}-${item.label}`} value={item.prefix}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="relative">
            <input
              className={baseFieldClass}
              placeholder="Mobile number"
              value={data.mobileNumber}
              onChange={(e) => updateField("mobileNumber", normalizeDigits(e.target.value))}
              maxLength={mobileRule?.maxLength ?? 12}
            />
            <label className={labelClass}>Mobile number</label>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency Contact</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="relative">
            <input
              className={baseFieldClass}
              placeholder="Emergency contact name"
              value={data.emergencyName}
              onChange={(e) => updateField("emergencyName", e.target.value)}
            />
            <label className={labelClass}>Emergency contact name</label>
          </div>
          <div className="grid grid-cols-[170px_1fr] gap-2">
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              value={data.emergencyPhonePrefix}
              onChange={(e) => updateField("emergencyPhonePrefix", e.target.value)}
            >
              {PHONE_PREFIX_OPTIONS.map((item) => (
                <option key={`${item.prefix}-${item.label}-emergency`} value={item.prefix}>
                  {item.label}
                </option>
              ))}
            </select>
            <div className="relative">
              <input
                className={baseFieldClass}
                placeholder="Emergency contact phone"
                value={data.emergencyPhoneNumber}
                onChange={(e) => updateField("emergencyPhoneNumber", normalizeDigits(e.target.value))}
                maxLength={emergencyRule?.maxLength ?? 12}
              />
              <label className={labelClass}>Emergency phone</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
