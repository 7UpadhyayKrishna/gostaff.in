import type { OnboardingData } from "@/src/hooks/useOnboardingForm";
import { PHONE_PREFIX_OPTIONS, normalizeDigits } from "@/src/lib/countries";

type DraftDoc = { type: string; documentNumber?: string | null; expiryDate?: string | Date | null };

export type DraftEmployeePayload = {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  fullName: string;
  nationality: string;
  mobile: string;
  emergencyName: string;
  emergencyPhone: string;
  jobTitle: string;
  department: string;
  contractType: string;
  contractStart: string | Date;
  contractEnd?: string | Date | null;
  documents?: DraftDoc[];
  payrollConfig?: {
    basicSalary?: number | null;
    housingAllowance?: number | null;
    transportAllowance?: number | null;
    bankName?: string | null;
    iban?: string | null;
  } | null;
  approval?: { note?: string | null } | null;
};

function splitInternationalToForm(full: string): { prefix: string; number: string } {
  const t = (full ?? "").trim();
  const sorted = [...PHONE_PREFIX_OPTIONS].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix } of sorted) {
    if (t.startsWith(prefix)) {
      return { prefix, number: normalizeDigits(t.slice(prefix.length)) };
    }
  }
  return { prefix: "+971", number: normalizeDigits(t) };
}

function isoDateInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  if (typeof d === "string") return d.length >= 10 ? d.slice(0, 10) : "";
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function docByType(docs: DraftDoc[] | undefined, typ: string) {
  return (docs ?? []).find((d) => d.type === typ);
}

/** Maps GET `/api/onboarding/[draftId]` employee JSON into wizard form state. */
export function mapEmployeeDraftToOnboardingData(emp: DraftEmployeePayload): OnboardingData {
  const mob = splitInternationalToForm(emp.mobile);
  const em = splitInternationalToForm(emp.emergencyPhone);
  const passport = docByType(emp.documents, "PASSPORT");
  const eid = docByType(emp.documents, "EMIRATES_ID");
  const pc = emp.payrollConfig;

  return {
    firstName: emp.firstName ?? "",
    middleName: emp.middleName ?? "",
    lastName: emp.lastName ?? "",
    fullName: emp.fullName ?? "",
    nationality: emp.nationality ?? "",
    mobilePrefix: mob.prefix,
    mobileNumber: mob.number,
    mobile: `${mob.prefix}${mob.number}`,
    emergencyName: emp.emergencyName ?? "",
    emergencyPhonePrefix: em.prefix,
    emergencyPhoneNumber: em.number,
    emergencyPhone: `${em.prefix}${em.number}`,
    jobTitle: emp.jobTitle ?? "SECURITY_GUARD",
    department: emp.department ?? "OPERATIONS",
    contractType: emp.contractType ?? "LIMITED",
    contractStart: isoDateInput(emp.contractStart),
    contractEnd: emp.contractType === "UNLIMITED" ? "" : isoDateInput(emp.contractEnd),
    passportNumber: passport?.documentNumber ?? "",
    passportExpiry: isoDateInput(passport?.expiryDate),
    emiratesIdNumber: eid?.documentNumber ?? "",
    emiratesIdExpiry: isoDateInput(eid?.expiryDate),
    basicSalary: pc?.basicSalary != null ? Number(pc.basicSalary) : 1500,
    housingAllowance: pc?.housingAllowance != null ? Number(pc.housingAllowance) : 0,
    transportAllowance: pc?.transportAllowance != null ? Number(pc.transportAllowance) : 0,
    bankName: pc?.bankName ?? "",
    iban: pc?.iban ?? "",
    approvalNote: emp.approval?.note ?? "",
    supervisorEmail: "",
    supervisorPassword: "",
  };
}
