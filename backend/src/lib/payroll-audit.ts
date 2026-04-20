import type { Prisma, PayrollRunStatus } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";

type AuditInput = {
  demoSessionId: string;
  payrollRunId: string;
  actorUserId: string;
  action: string;
  fromStatus?: PayrollRunStatus | null;
  toStatus: PayrollRunStatus;
  metadata?: Prisma.InputJsonValue;
};

export async function logPayrollRunAudit(input: AuditInput) {
  await prisma.payrollRunAuditLog.create({
    data: {
      demoSessionId: input.demoSessionId,
      payrollRunId: input.payrollRunId,
      actorUserId: input.actorUserId,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      metadata: input.metadata,
    },
  });
}
