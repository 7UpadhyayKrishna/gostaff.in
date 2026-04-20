-- CreateTable
CREATE TABLE "PayrollRunAuditLog" (
    "id" TEXT NOT NULL,
    "demoSessionId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "PayrollRunStatus",
    "toStatus" "PayrollRunStatus" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRunAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollRunAuditLog_demoSessionId_createdAt_idx" ON "PayrollRunAuditLog"("demoSessionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PayrollRunAuditLog_payrollRunId_createdAt_idx" ON "PayrollRunAuditLog"("payrollRunId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "PayrollRunAuditLog" ADD CONSTRAINT "PayrollRunAuditLog_demoSessionId_fkey" FOREIGN KEY ("demoSessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunAuditLog" ADD CONSTRAINT "PayrollRunAuditLog_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunAuditLog" ADD CONSTRAINT "PayrollRunAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
