import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";
import { logPayrollRunAudit } from "@/src/lib/payroll-audit";

export async function POST(req: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["OPS_DIRECTOR"], "Only Operation can give final payroll approval");
    const { runId } = await params;
    const body = (await req.json().catch(() => ({}))) as { action?: "APPROVE" | "REJECT"; note?: string };
    const action = body.action ?? "APPROVE";
    const note = body.note;

    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, demoSessionId: session.demoSessionId },
      include: { payslips: true },
    });

    if (!run) return apiError("Payroll run not found", 404);

    if (action === "REJECT") {
      const rejected = await prisma.payrollRun.update({
        where: { id: runId },
        data: { status: "REJECTED", rejectedNote: note ?? "Rejected by Operation", approvedAt: null, approvedByUserId: null },
      });
      await logPayrollRunAudit({
        demoSessionId: session.demoSessionId,
        payrollRunId: run.id,
        actorUserId: session.userId,
        action: "REJECT",
        fromStatus: run.status,
        toStatus: "REJECTED",
        metadata: { note: note ?? "Rejected by Operation" },
      });
      return Response.json(rejected);
    }

    await prisma.payslip.updateMany({ where: { payrollRunId: runId }, data: { wpsStatus: "SENT" } });
    const updatedRun = await prisma.payrollRun.update({
      where: { id: runId },
      data: { status: "APPROVED", approvedAt: new Date(), approvedByUserId: session.userId, rejectedNote: null },
    });
    await logPayrollRunAudit({
      demoSessionId: session.demoSessionId,
      payrollRunId: run.id,
      actorUserId: session.userId,
      action: "APPROVE",
      fromStatus: run.status,
      toStatus: "APPROVED",
    });

    return Response.json(updatedRun);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to send payroll run", 400);
  }
}
