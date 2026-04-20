-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'FINANCE';

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Timesheet"
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "TimesheetStatus"
USING (CASE
  WHEN "status" = 'APPROVED' THEN 'APPROVED'::"TimesheetStatus"
  WHEN "status" = 'REJECTED' THEN 'REJECTED'::"TimesheetStatus"
  ELSE 'PENDING'::"TimesheetStatus"
END),
ALTER COLUMN "status" SET DEFAULT 'PENDING';
