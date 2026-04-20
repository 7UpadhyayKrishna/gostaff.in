import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";
import { logPayrollRunAudit } from "@/src/lib/payroll-audit";

export async function GET(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "OWNER"]);
    const { runId } = await params;

    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, demoSessionId: session.demoSessionId },
      include: {
        payslips: {
          include: { employee: { select: { id: true, fullName: true, employeeId: true } } },
          orderBy: { generatedAt: "desc" },
        },
      },
    });
    if (!run) return apiError("Payroll run not found", 404);
    if (run.status !== "APPROVED" && run.status !== "EXPORTED" && run.status !== "CLOSED") {
      return apiError("Payroll run must be approved before export", 409);
    }

    const nextStatus = run.status === "CLOSED" ? "CLOSED" : "EXPORTED";
    await prisma.payrollRun.update({
      where: { id: runId },
      data: { status: nextStatus, exportedAt: new Date() },
    });
    if (nextStatus !== run.status) {
      await logPayrollRunAudit({
        demoSessionId: session.demoSessionId,
        payrollRunId: run.id,
        actorUserId: session.userId,
        action: "EXPORT_PAYSLIPS",
        fromStatus: run.status,
        toStatus: nextStatus,
      });
    }

    return Response.json({
      runId: run.id,
      month: run.month,
      status: run.status,
      payslips: run.payslips.map((p) => ({
        employeeId: p.employee?.employeeId ?? "",
        employeeName: p.employee?.fullName ?? "",
        basicSalary: p.basicSalary,
        allowances: p.allowances,
        deductions: p.deductions,
        netSalary: p.netSalary,
        wpsStatus: p.wpsStatus,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to export payslips", 400);
  }
}
