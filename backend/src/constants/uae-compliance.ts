export const DOCUMENT_EXPIRY_THRESHOLDS = {
  PASSPORT: { warnDays: 180, label: "6 months" },
  EMIRATES_ID: { warnDays: 90, label: "3 months" },
  RESIDENCE_VISA: { warnDays: 60, label: "60 days" },
  LABOUR_CARD: { warnDays: 60, label: "60 days" },
} as const;

export const UAE_LABOUR_DEFAULTS = {
  PROBATION_MONTHS: 6,
  NOTICE_DAYS: 30,
  ANNUAL_LEAVE_DAYS: 30,
  WORKING_DAYS_PER_MONTH: 30,
  WORKING_HOURS_PER_DAY: 8,
} as const;

export const GRATUITY_RULES = {
  MIN_SERVICE_YEARS: 1,
  TIER_1_MAX_YEARS: 5,
  TIER_1_DAYS: 21,
  TIER_2_DAYS: 30,
  RESIGNATION_1_3_YRS: 1 / 3,
  RESIGNATION_3_5_YRS: 2 / 3,
  RESIGNATION_5_PLUS: 1,
} as const;
