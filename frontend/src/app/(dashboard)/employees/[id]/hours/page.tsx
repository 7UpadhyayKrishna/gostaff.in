"use client";

import { useParams } from "next/navigation";
import { EmployeeHoursCalendarClient } from "@/src/components/employees/EmployeeHoursCalendarClient";

export default function EmployeeHoursPage() {
  const params = useParams<{ id: string }>();
  if (!params?.id) return <p className="text-sm text-slate-500">Loading…</p>;
  return <EmployeeHoursCalendarClient employeeId={params.id} />;
}
