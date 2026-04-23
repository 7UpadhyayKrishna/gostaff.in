import test from "node:test";
import assert from "node:assert/strict";
import type { PayrollConfig } from "@prisma/client";
import { toTimesheetLikeInputsFromPayrollEntries } from "@/src/lib/payroll/from-payroll-entries";
import { computeMonthlyPayFromTimesheets } from "@/src/lib/payroll/from-timesheets";

const payrollConfig: PayrollConfig = {
  id: "cfg-1",
  employeeId: "emp-1",
  basicSalary: 3000,
  housingAllowance: 500,
  transportAllowance: 250,
  otherAllowances: null,
  paymentMethod: "WPS_BANK",
  bankName: null,
  iban: null,
  paymentFrequency: "MONTHLY",
  firstPayrollMonth: "2026-04",
  payrollGrade: null,
  gratuityStart: new Date("2024-01-01T00:00:00.000Z"),
  leaveEntitlement: 30,
  advanceRecovery: 0,
  accommodationDeduction: 0,
  loanEmi: 0,
};

test("adapter produces timesheet-like lines with regular and overtime split", () => {
  const rows = toTimesheetLikeInputsFromPayrollEntries([
    { date: new Date("2026-04-17T00:00:00.000Z"), hoursWorked: 10, overtime: 2 },
  ]);
  assert.equal(rows.length, 1);
  const day = (rows[0].dailyBreakdown as Array<{ date: string; regular: number; ot: number }>).find((d) => d.date === "2026-04-17");
  assert.deepEqual(day, { date: "2026-04-17", regular: 8, ot: 2 });
  assert.ok((rows[0].dailyBreakdown as Array<unknown>).length >= 28);
});

test("monthly formula stays unchanged when fed adapted payroll entries", () => {
  const sourceRows = [{ date: new Date("2026-04-17T00:00:00.000Z"), hoursWorked: 10, overtime: 2 }];
  const adapted = toTimesheetLikeInputsFromPayrollEntries(sourceRows);
  const pay = computeMonthlyPayFromTimesheets(payrollConfig, adapted);
  assert.equal(pay.weekdayOtHours, 2);
  assert.equal(pay.fridayOtHours, 0);
  assert.equal(pay.publicHolidayHours, 0);
  assert.ok(pay.absentDays > 0);
  assert.equal(pay.netSalary, pay.grossSalary);
});

test("allowances are prorated by regular hours and OT is excluded from allowances", () => {
  const rows = toTimesheetLikeInputsFromPayrollEntries([
    { date: new Date("2026-04-01T00:00:00.000Z"), hoursWorked: 10, overtime: 2 },
    { date: new Date("2026-04-02T00:00:00.000Z"), hoursWorked: 8, overtime: 0 },
  ]);
  const pay = computeMonthlyPayFromTimesheets(payrollConfig, rows);

  // April 2026 has 26 non-Friday weekdays => expectedRegularHours = 208
  // Regular hours here = 16 (8 + 8), so allowance ratio = 16/208
  const expectedAllowances = (payrollConfig.housingAllowance + payrollConfig.transportAllowance) * (16 / 208);
  assert.ok(Math.abs(pay.allowances - expectedAllowances) < 1e-8);

  const baseHourly = payrollConfig.basicSalary / 30 / 8;
  const otComponent = 2 * baseHourly * 1.25;
  const grossWithoutOt = pay.basicSalary + pay.allowances;
  assert.ok(Math.abs(pay.grossSalary - (grossWithoutOt + otComponent)) < 1e-8);
});

test("payable basic is zero when no regular hours are worked", () => {
  const rows = toTimesheetLikeInputsFromPayrollEntries([
    { date: new Date("2026-04-17T00:00:00.000Z"), hoursWorked: 0, overtime: 0 },
  ]);
  const pay = computeMonthlyPayFromTimesheets(payrollConfig, rows);
  assert.equal(pay.basicSalary, 0);
  assert.equal(pay.allowances, 0);
  assert.equal(pay.grossSalary, 0);
  assert.equal(pay.netSalary, 0);
});
