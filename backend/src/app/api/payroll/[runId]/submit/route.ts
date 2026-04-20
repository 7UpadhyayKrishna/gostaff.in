import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";
import { getPayrollSubmitBlockers } from "@/src/lib/payroll-validations";
import { logPayrollRunAudit } from "@/src/lib/payroll-audit";

export async function POST(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can submit payroll runs");
    const { runId } = await params;

    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, demoSessionId: session.demoSessionId },
      select: { id: true, month: true, status: true, anomalySummary: true },
    });
    if (!run) return apiError("Payroll run not found", 404);

    const blockedCount = Number((run.anomalySummary as any)?.blockedCount ?? 0);
    if (blockedCount > 0) {
      return apiError("Cannot submit. Some sites are still not locked.", 409);
    }

    const blockers = await getPayrollSubmitBlockers({
      demoSessionId: session.demoSessionId,
      payrollRunId: run.id,
      period: run.month,
    });
    if (blockers.length > 0) {
      return Response.json(
        {
          success: false,
          error: "PAYROLL_SUBMIT_VALIDATION_FAILED",
          message: "Payroll run cannot be submitted until blockers are resolved.",
          blockers,
        },
        { status: 409 },
      );
    }

    const updated = await prisma.payrollRun.update({
      where: { id: runId },
      data: { status: "READY_FOR_APPROVAL", submittedAt: new Date(), rejectedNote: null },
    });
    await logPayrollRunAudit({
      demoSessionId: session.demoSessionId,
      payrollRunId: run.id,
      actorUserId: session.userId,
      action: "SUBMIT_FOR_APPROVAL",
      fromStatus: run.status,
      toStatus: "READY_FOR_APPROVAL",
    });

    return Response.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to submit payroll run", 400);
  }
}
