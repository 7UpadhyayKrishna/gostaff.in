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
  assert.deepEqual(rows[0].dailyBreakdown, [{ date: "2026-04-17", regular: 8, ot: 2 }]);
});

test("monthly formula stays unchanged when fed adapted payroll entries", () => {
  const sourceRows = [{ date: new Date("2026-04-17T00:00:00.000Z"), hoursWorked: 10, overtime: 2 }];
  const adapted = toTimesheetLikeInputsFromPayrollEntries(sourceRows);
  const pay = computeMonthlyPayFromTimesheets(payrollConfig, adapted);
  assert.equal(pay.weekdayOtHours, 2);
  assert.equal(pay.fridayOtHours, 0);
  assert.equal(pay.publicHolidayHours, 0);
  assert.ok(pay.grossSalary > payrollConfig.basicSalary);
});
