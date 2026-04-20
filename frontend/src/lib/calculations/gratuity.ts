export interface GratuityInput {
  contractStart: Date;
  lastWorkingDay: Date;
  basicSalary: number;
  exitReason: "RESIGNATION" | "TERMINATION" | "CONTRACT_END" | "RETIREMENT";
}

export function calculateGratuity(input: GratuityInput) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const serviceDays = Math.floor((input.lastWorkingDay.getTime() - input.contractStart.getTime()) / msPerDay);
  const serviceYears = serviceDays / 365;
  const dailyRate = input.basicSalary / 30;
  if (serviceYears < 1) return { serviceYears, serviceDays, dailyRate, baseGratuityDays: 0, reductionFactor: 0, finalGratuityDays: 0, gratuityAmount: 0, breakdown: ["Service below 1 year"] };
  const baseGratuityDays = serviceYears <= 5 ? serviceYears * 21 : 105 + (serviceYears - 5) * 30;
  const reductionFactor = input.exitReason === "RESIGNATION" ? (serviceYears < 3 ? 1 / 3 : serviceYears < 5 ? 2 / 3 : 1) : 1;
  const finalGratuityDays = baseGratuityDays * reductionFactor;
  const cap = input.basicSalary * 24;
  const gratuityAmount = Math.min(cap, finalGratuityDays * dailyRate);
  return { serviceYears, serviceDays, dailyRate, baseGratuityDays, reductionFactor, finalGratuityDays, gratuityAmount, cappedAt: gratuityAmount === cap ? cap : undefined, breakdown: [] as string[] };
}
