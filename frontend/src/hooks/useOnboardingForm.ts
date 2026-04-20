"use client";

import { useMemo, useState } from "react";
import { normalizeDigits, validatePhoneNumberByPrefix } from "@/src/lib/countries";

export type OnboardingData = {
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  nationality: string;
  mobilePrefix: string;
  mobileNumber: string;
  mobile: string;
  emergencyName: string;
  emergencyPhonePrefix: string;
  emergencyPhoneNumber: string;
  emergencyPhone: string;
  jobTitle: string;
  department: string;
  contractType: string;
  contractStart: string;
  contractEnd: string;
  passportNumber: string;
  passportExpiry: string;
  emiratesIdNumber: string;
  emiratesIdExpiry: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  bankName: string;
  iban: string;
  approvalNote: string;
  /** Required when jobTitle is SUPERVISOR — used to create the site supervisor login on submit. */
  supervisorEmail: string;
  supervisorPassword: string;
};

const defaults: OnboardingData = {
  firstName: "",
  middleName: "",
  lastName: "",
  fullName: "",
  nationality: "",
  mobilePrefix: "+971",
  mobileNumber: "",
  mobile: "",
  emergencyName: "",
  emergencyPhonePrefix: "+971",
  emergencyPhoneNumber: "",
  emergencyPhone: "",
  jobTitle: "SECURITY_GUARD",
  department: "OPERATIONS",
  contractType: "LIMITED",
  contractStart: "",
  contractEnd: "",
  passportNumber: "",
  passportExpiry: "",
  emiratesIdNumber: "",
  emiratesIdExpiry: "",
  basicSalary: 1500,
  housingAllowance: 0,
  transportAllowance: 0,
  bankName: "",
  iban: "",
  approvalNote: "",
  supervisorEmail: "",
  supervisorPassword: "",
};

/** Stages: 1 Personal, 2 Employment, 3 Documents, 4 Payroll, 5 Approval note, 6 Confirmation. */
const stageRules: Record<number, (keyof OnboardingData)[]> = {
  1: [
    "firstName",
    "lastName",
    "nationality",
    "mobilePrefix",
    "mobileNumber",
    "emergencyName",
    "emergencyPhonePrefix",
    "emergencyPhoneNumber",
  ],
  2: ["jobTitle", "department", "contractType", "contractStart"],
  3: ["passportNumber", "passportExpiry", "emiratesIdNumber", "emiratesIdExpiry"],
  4: ["basicSalary", "bankName", "iban"],
  5: [],
  6: [],
};

export function useOnboardingForm() {
  const [stage, setStage] = useState(1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData>(defaults);

  const errors = useMemo(() => {
    const required = stageRules[stage] ?? [];
    const requiredErrors = required.filter((field) => {
      const value = data[field];
      if (typeof value === "number") return Number.isNaN(value) || value <= 0;
      return String(value).trim().length === 0;
    });

    if (stage === 2 && data.contractType === "LIMITED" && !data.contractEnd.trim()) {
      return [...requiredErrors, "contractEnd"];
    }

    if (stage === 2 && data.jobTitle === "SUPERVISOR") {
      const extra: string[] = [];
      const email = data.supervisorEmail.trim();
      if (!email) extra.push("supervisorEmail");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) extra.push("supervisorEmailFormat");
      if (!data.supervisorPassword.trim()) extra.push("supervisorPassword");
      else if (data.supervisorPassword.length < 6) extra.push("supervisorPasswordLength");
      if (extra.length) return [...requiredErrors, ...extra];
    }

    if (stage !== 1) {
      return requiredErrors;
    }

    const mobileCheck = validatePhoneNumberByPrefix(data.mobilePrefix, data.mobileNumber);
    const emergencyCheck = validatePhoneNumberByPrefix(data.emergencyPhonePrefix, data.emergencyPhoneNumber);
    const formatErrors: string[] = [];
    if (!mobileCheck.ok) formatErrors.push(`mobile: ${mobileCheck.error}`);
    if (!emergencyCheck.ok) formatErrors.push(`emergencyPhone: ${emergencyCheck.error}`);

    return [...requiredErrors, ...formatErrors];
  }, [data, stage]);

  const payloadData = useMemo(() => {
    const firstName = data.firstName.trim();
    const middleName = data.middleName.trim();
    const lastName = data.lastName.trim();
    const mobileNumber = normalizeDigits(data.mobileNumber);
    const emergencyNumber = normalizeDigits(data.emergencyPhoneNumber);
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

    return {
      ...data,
      firstName,
      middleName,
      lastName,
      fullName,
      mobilePrefix: data.mobilePrefix.trim(),
      mobileNumber,
      mobile: `${data.mobilePrefix.trim()}${mobileNumber}`,
      emergencyPhonePrefix: data.emergencyPhonePrefix.trim(),
      emergencyPhoneNumber: emergencyNumber,
      emergencyPhone: `${data.emergencyPhonePrefix.trim()}${emergencyNumber}`,
      contractEnd: data.contractType === "UNLIMITED" ? "" : data.contractEnd,
    };
  }, [data]);

  function updateField<K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  return {
    stage,
    setStage,
    draftId,
    setDraftId,
    data,
    setData,
    payloadData,
    updateField,
    stageErrors: errors,
    canContinue: errors.length === 0,
  };
}
