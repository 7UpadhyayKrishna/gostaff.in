export type DocumentType =
  | "PASSPORT"
  | "EMIRATES_ID"
  | "RESIDENCE_VISA"
  | "LABOUR_CARD"
  | "OFFER_LETTER"
  | "SIGNED_CONTRACT"
  | "MEDICAL_FITNESS"
  | "BACKGROUND_CHECK";
import { DOCUMENT_EXPIRY_THRESHOLDS } from "@/src/constants/uae-compliance";

export type AlertLevel = "RED" | "YELLOW" | "GREEN";

export function getDocumentAlertLevel(expiryDate: Date, docType: DocumentType): AlertLevel {
  const threshold = (DOCUMENT_EXPIRY_THRESHOLDS as Record<string, { warnDays: number }>)[docType];
  if (!threshold) return "YELLOW";
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysUntilExpiry < 0) return "RED";
  if (daysUntilExpiry < threshold.warnDays) return "RED";
  if (daysUntilExpiry < threshold.warnDays * 2) return "YELLOW";
  return "GREEN";
}
