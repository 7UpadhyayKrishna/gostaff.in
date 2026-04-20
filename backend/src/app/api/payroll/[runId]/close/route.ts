import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";
import { logPayrollRunAudit } from "@/src/lib/payroll-audit";

export async function POST(req: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can close payroll period");
    const { runId } = await params;
    const body = (await req.json().catch(() => ({}))) as { confirmationToken?: string };
    if (body.confirmationToken !== "CONFIRM_CLOSE_PAYROLL") {
      return apiError("Explicit confirmation is required to close payroll period.", 400);
    }

    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, demoSessionId: session.demoSessionId },
      select: { id: true, status: true, exportedAt: true },
    });
    if (!run) return apiError("Payroll run not found", 404);
    if (!["APPROVED", "EXPORTED"].includes(run.status)) {
      return apiError("Only approved/exported run can be closed", 409);
    }
    if (!run.exportedAt) {
      return apiError("Payroll run must be exported at least once before closing.", 409);
    }

    const closed = await prisma.payrollRun.update({
      where: { id: runId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    await logPayrollRunAudit({
      demoSessionId: session.demoSessionId,
      payrollRunId: run.id,
      actorUserId: session.userId,
      action: "CLOSE_PERIOD",
      fromStatus: run.status,
      toStatus: "CLOSED",
    });
    return Response.json(closed);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to close payroll run", 400);
  }
}
