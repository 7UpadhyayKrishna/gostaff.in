-- Timesheet status enum migration
CREATE TYPE "TimesheetStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'VALIDATED', 'LOCKED', 'REJECTED');
ALTER TABLE "Timesheet" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Timesheet"
ALTER COLUMN "status" TYPE "TimesheetStatus_new"
USING (
  CASE
    WHEN "status"::text = 'PENDING' THEN 'SUBMITTED'::"TimesheetStatus_new"
    WHEN "status"::text = 'APPROVED' THEN 'VALIDATED'::"TimesheetStatus_new"
    ELSE 'REJECTED'::"TimesheetStatus_new"
  END
);
ALTER TYPE "TimesheetStatus" RENAME TO "TimesheetStatus_old";
ALTER TYPE "TimesheetStatus_new" RENAME TO "TimesheetStatus";
DROP TYPE "TimesheetStatus_old";

-- Payroll run status enum migration
CREATE TYPE "PayrollRunStatus_new" AS ENUM ('COLLECTING', 'VALIDATING', 'READY_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'EXPORTED', 'CLOSED');
ALTER TABLE "PayrollRun" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PayrollRun"
ALTER COLUMN "status" TYPE "PayrollRunStatus_new"
USING (
  CASE
    WHEN "status"::text = 'DRAFT' THEN 'COLLECTING'::"PayrollRunStatus_new"
    WHEN "status"::text = 'VALIDATED' THEN 'VALIDATING'::"PayrollRunStatus_new"
    WHEN "status"::text = 'SENT' THEN 'APPROVED'::"PayrollRunStatus_new"
    WHEN "status"::text = 'FAILED' THEN 'REJECTED'::"PayrollRunStatus_new"
    ELSE 'CLOSED'::"PayrollRunStatus_new"
  END
);
ALTER TYPE "PayrollRunStatus" RENAME TO "PayrollRunStatus_old";
ALTER TYPE "PayrollRunStatus_new" RENAME TO "PayrollRunStatus";
DROP TYPE "PayrollRunStatus_old";

-- Timesheet workflow audit columns
ALTER TABLE "Timesheet" ADD COLUMN "period" TEXT;
UPDATE "Timesheet" SET "period" = to_char("weekStart", 'YYYY-MM') WHERE "period" IS NULL;
ALTER TABLE "Timesheet" ALTER COLUMN "period" SET NOT NULL;
ALTER TABLE "Timesheet" ADD COLUMN "siteIdSnapshot" TEXT;
ALTER TABLE "Timesheet" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "Timesheet" ADD COLUMN "validatedAt" TIMESTAMP(3);
ALTER TABLE "Timesheet" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "Timesheet" ADD COLUMN "validatedByUserId" TEXT;
ALTER TABLE "Timesheet" ADD COLUMN "rejectionNote" TEXT;
ALTER TABLE "Timesheet" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
CREATE INDEX "Timesheet_period_status_idx" ON "Timesheet"("period", "status");
ALTER TABLE "Timesheet"
ADD CONSTRAINT "Timesheet_validatedByUserId_fkey"
FOREIGN KEY ("validatedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Site submission tracker
CREATE TABLE "SiteTimesheetSubmission" (
  "id" TEXT NOT NULL,
  "demoSessionId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "validatedAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "validatedByUserId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteTimesheetSubmission_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SiteTimesheetSubmission"
ADD CONSTRAINT "SiteTimesheetSubmission_demoSessionId_fkey"
FOREIGN KEY ("demoSessionId") REFERENCES "DemoSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteTimesheetSubmission"
ADD CONSTRAINT "SiteTimesheetSubmission_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "Site"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteTimesheetSubmission"
ADD CONSTRAINT "SiteTimesheetSubmission_validatedByUserId_fkey"
FOREIGN KEY ("validatedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "SiteTimesheetSubmission_demoSessionId_siteId_period_key" ON "SiteTimesheetSubmission"("demoSessionId","siteId","period");
CREATE INDEX "SiteTimesheetSubmission_demoSessionId_period_status_idx" ON "SiteTimesheetSubmission"("demoSessionId","period","status");

-- Payroll run lifecycle/audit columns
ALTER TABLE "PayrollRun" ADD COLUMN "submissionStatusBySite" JSONB;
ALTER TABLE "PayrollRun" ADD COLUMN "anomalySummary" JSONB;
ALTER TABLE "PayrollRun" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "PayrollRun" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "PayrollRun" ADD COLUMN "approvedByUserId" TEXT;
ALTER TABLE "PayrollRun" ADD COLUMN "rejectedNote" TEXT;
ALTER TABLE "PayrollRun" ADD COLUMN "exportedAt" TIMESTAMP(3);
ALTER TABLE "PayrollRun" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "PayrollRun" ALTER COLUMN "status" SET DEFAULT 'COLLECTING';
ALTER TABLE "PayrollRun"
ADD CONSTRAINT "PayrollRun_approvedByUserId_fkey"
FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
