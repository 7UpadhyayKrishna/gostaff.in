export function calculateLeaveEncashment(unusedLeaveDays: number, basicSalary: number) {
  return (basicSalary / 30) * unusedLeaveDays;
}
