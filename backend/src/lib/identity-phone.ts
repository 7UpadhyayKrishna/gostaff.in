type PhoneRule = {
  minLength: number;
  maxLength: number;
  pattern: RegExp;
  example: string;
};

const PHONE_RULES: Record<string, PhoneRule> = {
  "+971": { minLength: 9, maxLength: 9, pattern: /^5\d{8}$/, example: "501234567" },
  "+966": { minLength: 9, maxLength: 9, pattern: /^5\d{8}$/, example: "512345678" },
  "+974": { minLength: 8, maxLength: 8, pattern: /^[3-7]\d{7}$/, example: "33123456" },
  "+973": { minLength: 8, maxLength: 8, pattern: /^3\d{7}$/, example: "31234567" },
  "+965": { minLength: 8, maxLength: 8, pattern: /^[569]\d{7}$/, example: "51234567" },
  "+968": { minLength: 8, maxLength: 8, pattern: /^9\d{7}$/, example: "91234567" },
  "+91": { minLength: 10, maxLength: 10, pattern: /^[6-9]\d{9}$/, example: "9876543210" },
  "+92": { minLength: 10, maxLength: 10, pattern: /^3\d{9}$/, example: "3012345678" },
  "+1": { minLength: 10, maxLength: 10, pattern: /^[2-9]\d{9}$/, example: "2125551234" },
  "+44": { minLength: 10, maxLength: 10, pattern: /^[1-9]\d{9}$/, example: "2012345678" },
  "+61": { minLength: 9, maxLength: 9, pattern: /^[2-478]\d{8}$/, example: "412345678" },
};

const DEFAULT_PHONE_RULE: PhoneRule = {
  minLength: 6,
  maxLength: 12,
  pattern: /^\d+$/,
  example: "12345678",
};

function clean(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

export function splitLegacyFullName(fullName: unknown) {
  const raw = clean(fullName);
  if (!raw) {
    return { firstName: "", middleName: "", lastName: "" };
  }
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: "", lastName: parts[0] };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], middleName: "", lastName: parts[1] };
  }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

export function composeFullName(firstName: string, middleName: string, lastName: string) {
  return [firstName, middleName, lastName].map((item) => item.trim()).filter(Boolean).join(" ");
}

export function validatePhoneByPrefix(prefixInput: unknown, numberInput: unknown, label: string) {
  const prefix = clean(prefixInput);
  const number = clean(numberInput).replace(/\s+/g, "");
  const normalizedPrefix = prefix.startsWith("+") ? prefix : `+${prefix}`;
  const rule = PHONE_RULES[normalizedPrefix] ?? DEFAULT_PHONE_RULE;

  if (!/^\+\d{1,4}$/.test(normalizedPrefix)) {
    return { ok: false as const, error: `${label} prefix is invalid.` };
  }
  if (!/^\d+$/.test(number)) {
    return { ok: false as const, error: `${label} must contain digits only.` };
  }
  if (number.length < rule.minLength || number.length > rule.maxLength) {
    return {
      ok: false as const,
      error: `${label} must be ${rule.minLength === rule.maxLength ? `${rule.minLength}` : `${rule.minLength}-${rule.maxLength}`} digits for ${normalizedPrefix}.`,
    };
  }
  if (!rule.pattern.test(number)) {
    return {
      ok: false as const,
      error: `${label} format is invalid for ${normalizedPrefix} (example: ${rule.example}).`,
    };
  }

  return {
    ok: true as const,
    prefix: normalizedPrefix,
    number,
    fullNumber: `${normalizedPrefix}${number}`,
  };
}

export function parsePhoneInput(params: {
  prefixInput: unknown;
  numberInput: unknown;
  combinedInput: unknown;
  label: string;
  fallbackPrefix: string;
  fallbackNumber: string;
}) {
  const prefix = clean(params.prefixInput);
  const number = clean(params.numberInput);
  const combined = clean(params.combinedInput).replace(/\s+/g, "");

  if (prefix || number) {
    return validatePhoneByPrefix(prefix || params.fallbackPrefix, number || params.fallbackNumber, params.label);
  }

  if (!combined) {
    return validatePhoneByPrefix(params.fallbackPrefix, params.fallbackNumber, params.label);
  }

  const sortedPrefixes = Object.keys(PHONE_RULES).sort((a, b) => b.length - a.length);
  const matchedPrefix = sortedPrefixes.find((rulePrefix) => combined.startsWith(rulePrefix));
  if (matchedPrefix) {
    const localNumber = combined.slice(matchedPrefix.length);
    return validatePhoneByPrefix(matchedPrefix, localNumber, params.label);
  }

  const genericMatch = combined.match(/^(\+\d{1,4})(\d+)$/);
  if (!genericMatch) {
    return { ok: false as const, error: `${params.label} must include a valid country prefix.` };
  }
  return validatePhoneByPrefix(genericMatch[1], genericMatch[2], params.label);
}
