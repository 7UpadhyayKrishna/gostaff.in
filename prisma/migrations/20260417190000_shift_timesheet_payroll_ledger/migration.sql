-- CreateEnum
CREATE TYPE "ShiftSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "PayrollEntrySource" AS ENUM ('TIMESHEET');

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "demoSessionId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTimesheetSubmission" (
    "id" TEXT NOT NULL,
    "demoSessionId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "ShiftSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectionRemark" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftTimesheetSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTimesheetLineItem" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceStatus" "AttendanceStatus" NOT NULL,
    "hoursWorked" DOUBLE PRECISION NOT NULL,
    "overtime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manualHoursOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftTimesheetLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "demoSessionId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shiftId" TEXT NOT NULL,
    "shiftSubmissionId" TEXT NOT NULL,
    "hoursWorked" DOUBLE PRECISION NOT NULL,
    "overtime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" "PayrollEntrySource" NOT NULL DEFAULT 'TIMESHEET',
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPayrollLedger" (
    "id" TEXT NOT NULL,
    "demoSessionId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "overtime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPayrollLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shift_demoSessionId_siteId_idx" ON "Shift"("demoSessionId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_demoSessionId_siteId_name_key" ON "Shift"("demoSessionId", "siteId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftTimesheetSubmission_demoSessionId_siteId_shiftId_date_key" ON "ShiftTimesheetSubmission"("demoSessionId", "siteId", "shiftId", "date");

-- CreateIndex
CREATE INDEX "ShiftTimesheetSubmission_demoSessionId_date_status_idx" ON "ShiftTimesheetSubmission"("demoSessionId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftTimesheetLineItem_submissionId_employeeId_key" ON "ShiftTimesheetLineItem"("submissionId", "employeeId");

-- CreateIndex
CREATE INDEX "ShiftTimesheetLineItem_employeeId_submissionId_idx" ON "ShiftTimesheetLineItem"("employeeId", "submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_shiftSubmissionId_employeeId_key" ON "PayrollEntry"("shiftSubmissionId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollEntry_demoSessionId_employeeId_date_idx" ON "PayrollEntry"("demoSessionId", "employeeId", "date");

-- CreateIndex
CREATE INDEX "PayrollEntry_demoSessionId_date_idx" ON "PayrollEntry"("demoSessionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPayrollLedger_demoSessionId_employeeId_date_key" ON "DailyPayrollLedger"("demoSessionId", "employeeId", "date");

-- CreateIndex
CREATE INDEX "DailyPayrollLedger_demoSessionId_date_idx" ON "DailyPayrollLedger"("demoSessionId", "date");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_demoSessionId_fkey" FOREIGN KEY ("demoSessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTimesheetSubmission" ADD CONSTRAINT "ShiftTimesheetSubmission_demoSessionId_fkey" FOREIGN KEY ("demoSessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTimesheetSubmission" ADD CONSTRAINT "ShiftTimesheetSubmission_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTimesheetSubmission" ADD CONSTRAINT "ShiftTimesheetSubmission_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTimesheetSubmission" ADD CONSTRAINT "ShiftTimesheetSubmission_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTimesheetLineItem" ADD CONSTRAINT "ShiftTimesheetLineItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ShiftTimesheetSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTimesheetLineItem" ADD CONSTRAINT "ShiftTimesheetLineItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_demoSessionId_fkey" FOREIGN KEY ("demoSessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_shiftSubmissionId_fkey" FOREIGN KEY ("shiftSubmissionId") REFERENCES "ShiftTimesheetSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPayrollLedger" ADD CONSTRAINT "DailyPayrollLedger_demoSessionId_fkey" FOREIGN KEY ("demoSessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPayrollLedger" ADD CONSTRAINT "DailyPayrollLedger_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
