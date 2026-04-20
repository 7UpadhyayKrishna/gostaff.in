"use client";
import { useEffect, useState } from "react";

export type ComplianceAlert = {
  id: string;
  type: string;
  status: string;
  alertLevel: "RED" | "YELLOW" | "GREEN";
  expiryDate?: string | null;
  overallStatus?: "COMPLIANT" | "EXPIRING_SOON" | "OVERDUE";
  nearestExpiryDate?: string | null;
  daysToExpiry?: number | null;
  employee?: { fullName?: string; employeeId?: string };
};

export function useComplianceAlerts() {
  const [items, setItems] = useState<ComplianceAlert[]>([]);

  useEffect(() => {
    fetch("/api/compliance")
      .then((r) => r.json())
      .then((payload) => {
        if (Array.isArray(payload)) setItems(payload);
      })
      .catch(() => {});
  }, []);

  return items;
}
