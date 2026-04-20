-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'VALIDATED', 'SENT', 'FAILED', 'CLOSED');

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "payrollRunId" TEXT;

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "demoSessionId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "totalGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_demoSessionId_month_key" ON "PayrollRun"("demoSessionId", "month");

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_demoSessionId_fkey" FOREIGN KEY ("demoSessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
