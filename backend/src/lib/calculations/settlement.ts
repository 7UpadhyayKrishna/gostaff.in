import { calculateGratuity } from "@/src/lib/calculations/gratuity";
import { calculateLeaveEncashment } from "@/src/lib/calculations/leave-encashment";

export function buildSettlement(params: {
  contractStart: Date;
  lastWorkingDay: Date;
  basicSalary: number;
  exitReason: "RESIGNATION" | "TERMINATION" | "CONTRACT_END" | "RETIREMENT";
  unusedLeaveDays: number;
  finalMonthSalary: number;
  otherDeductions?: number;
}) {
  const gratuity = calculateGratuity(params);
  const leaveEncashment = calculateLeaveEncashment(params.unusedLeaveDays, params.basicSalary);
  const totalSettlement = gratuity.gratuityAmount + leaveEncashment + params.finalMonthSalary - (params.otherDeductions ?? 0);
  return { ...gratuity, unusedLeaveDays: params.unusedLeaveDays, leaveEncashment, finalMonthSalary: params.finalMonthSalary, otherDeductions: params.otherDeductions ?? 0, totalSettlement };
}
