import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

export async function GET(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "OWNER"], "Only HR, Operation, or Owner can view payroll runs");
    const { runId } = await params;

    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, demoSessionId: session.demoSessionId },
      include: {
        payslips: {
          include: {
            employee: { select: { id: true, fullName: true, employeeId: true } },
          },
          orderBy: { generatedAt: "desc" },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 25,
          include: { actorUser: { select: { name: true, email: true } } },
        },
      },
    });

    if (!run) return apiError("Payroll run not found", 404);
    return Response.json(run);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch payroll run detail", 400);
  }
}
