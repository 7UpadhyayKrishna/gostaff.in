export type CountryOption = {
  code: string;
  name: string;
};

export type PhoneRule = {
  minLength: number;
  maxLength: number;
  pattern: RegExp;
  example: string;
};

const COUNTRY_REGION_CODES = [
  "AF","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ",
  "BJ","BM","BT","BO","BQ","BA","BW","BV","BR","IO","BN","BG","BF","BI","CV","KH","CM","CA","KY","CF","TD","CL",
  "CN","CX","CC","CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO","EC","EG","SV",
  "GQ","ER","EE","SZ","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD",
  "GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT",
  "JM","JP","JE","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MG",
  "MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR",
  "NP","NL","NC","NZ","NI","NE","NG","NU","NF","MK","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN",
  "PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","RS","SC",
  "SL","SG","SX","SK","SI","SB","SO","ZA","GS","SS","ES","LK","SD","SR","SJ","SE","CH","SY","TW","TJ","TZ","TH",
  "TL","TG","TK","TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU","VE","VN","VG",
  "VI","WF","EH","YE","ZM","ZW",
];

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

export const COUNTRIES: CountryOption[] = COUNTRY_REGION_CODES
  .map((code) => ({ code, name: displayNames.of(code) ?? code }))
  .filter((item) => item.name && item.name !== item.code)
  .sort((a, b) => a.name.localeCompare(b.name));

export const PHONE_PREFIX_OPTIONS = [
  { label: "UAE (+971)", prefix: "+971" },
  { label: "Saudi Arabia (+966)", prefix: "+966" },
  { label: "Qatar (+974)", prefix: "+974" },
  { label: "Bahrain (+973)", prefix: "+973" },
  { label: "Kuwait (+965)", prefix: "+965" },
  { label: "Oman (+968)", prefix: "+968" },
  { label: "India (+91)", prefix: "+91" },
  { label: "Pakistan (+92)", prefix: "+92" },
  { label: "United Kingdom (+44)", prefix: "+44" },
  { label: "United States (+1)", prefix: "+1" },
  { label: "Canada (+1)", prefix: "+1" },
  { label: "Australia (+61)", prefix: "+61" },
];

export const PHONE_RULES: Record<string, PhoneRule> = {
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

const DEFAULT_PHONE_RULE: PhoneRule = { minLength: 6, maxLength: 12, pattern: /^\d+$/, example: "12345678" };

export function normalizeDigits(value: string) {
  return value.replace(/\D+/g, "");
}

export function validatePhoneNumberByPrefix(prefix: string, nationalNumberRaw: string) {
  const nationalNumber = normalizeDigits(nationalNumberRaw);
  const normalizedPrefix = prefix.startsWith("+") ? prefix : `+${prefix}`;
  const rule = PHONE_RULES[normalizedPrefix] ?? DEFAULT_PHONE_RULE;
  if (!/^\+\d{1,4}$/.test(normalizedPrefix)) {
    return { ok: false as const, error: "Phone prefix is invalid." };
  }
  if (!/^\d+$/.test(nationalNumber)) {
    return { ok: false as const, error: "Phone number must contain digits only." };
  }
  if (nationalNumber.length < rule.minLength || nationalNumber.length > rule.maxLength) {
    return {
      ok: false as const,
      error: `Phone number must be ${rule.minLength === rule.maxLength ? `${rule.minLength}` : `${rule.minLength}-${rule.maxLength}`} digits for ${normalizedPrefix}.`,
    };
  }
  if (!rule.pattern.test(nationalNumber)) {
    return { ok: false as const, error: `Phone format is invalid for ${normalizedPrefix} (example: ${rule.example}).` };
  }
  return { ok: true as const, fullNumber: `${normalizedPrefix}${nationalNumber}`, nationalNumber, prefix: normalizedPrefix };
}
