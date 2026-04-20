import { prisma } from "@/src/lib/prisma";

function toUtcDateOnly(date: Date) {
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export async function rebuildDailyPayrollLedgerForEmployeeDate(demoSessionId: string, employeeId: string, date: Date) {
  const dateOnly = toUtcDateOnly(date);
  const nextDay = new Date(dateOnly);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const rows = await prisma.payrollEntry.findMany({
    where: {
      demoSessionId,
      employeeId,
      date: { gte: dateOnly, lt: nextDay },
    },
    select: { hoursWorked: true, overtime: true },
  });

  const totalHours = rows.reduce((acc, row) => acc + Number(row.hoursWorked ?? 0), 0);
  const overtime = rows.reduce((acc, row) => acc + Number(row.overtime ?? 0), 0);

  await prisma.dailyPayrollLedger.upsert({
    where: {
      demoSessionId_employeeId_date: {
        demoSessionId,
        employeeId,
        date: dateOnly,
      },
    },
    update: { totalHours, overtime },
    create: {
      demoSessionId,
      employeeId,
      date: dateOnly,
      totalHours,
      overtime,
    },
  });
}
