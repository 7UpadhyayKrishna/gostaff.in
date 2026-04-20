import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";
import { logPayrollRunAudit } from "@/src/lib/payroll-audit";

export async function GET(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR"]);
    const { runId } = await params;

    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, demoSessionId: session.demoSessionId },
      include: {
        payslips: {
          include: {
            employee: {
              include: { payrollConfig: { select: { iban: true, bankName: true } } },
            },
          },
        },
      },
    });
    if (!run) return apiError("Payroll run not found", 404);
    if (!["APPROVED", "EXPORTED", "CLOSED"].includes(run.status)) {
      return apiError("Payroll run must be approved before WPS export", 409);
    }

    const lines = run.payslips.map((p) => ({
      employeeCode: p.employee?.employeeId ?? "",
      iban: p.employee?.payrollConfig?.iban ?? "",
      bankName: p.employee?.payrollConfig?.bankName ?? "",
      amount: Number(p.netSalary.toFixed(2)),
      reference: `${run.month}-${p.employee?.employeeId ?? p.id}`,
    }));
    await logPayrollRunAudit({
      demoSessionId: session.demoSessionId,
      payrollRunId: run.id,
      actorUserId: session.userId,
      action: "EXPORT_WPS",
      fromStatus: run.status,
      toStatus: run.status,
      metadata: { rows: lines.length },
    });

    return Response.json({ runId: run.id, month: run.month, wpsLines: lines });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to export WPS data", 400);
  }
}
