import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { clearCacheByPrefix } from "@/src/lib/response-cache";
import { apiError } from "@/src/lib/api-error";

type ApprovalAction = "APPROVE" | "REJECT" | "FLAG";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["OPS_DIRECTOR"], "Only Operation can decide approvals");
    const { id } = await params;
    const body = (await req.json()) as { action?: ApprovalAction; note?: string };

    const existing = await prisma.approval.findFirst({
      where: { id, employee: { demoSessionId: session.demoSessionId } },
      include: { employee: true },
    });

    if (!existing) return apiError("Approval not found", 404);

    const status = body.action === "APPROVE" ? "APPROVED" : body.action === "FLAG" ? "CONDITIONALLY_APPROVED" : "REJECTED";

    const approval = await prisma.approval.update({
      where: { id },
      data: {
        status,
        note: body.note ?? null,
        decidedAt: new Date(),
      },
    });

    await prisma.employee.update({
      where: { id: existing.employeeId },
      data: {
        status: status === "APPROVED" ? "ACTIVE" : status === "CONDITIONALLY_APPROVED" ? "CONDITIONALLY_APPROVED" : "REJECTED",
        onboardingStage: status === "APPROVED" ? 6 : existing.employee.onboardingStage,
      },
    });
    clearCacheByPrefix(`approvals:list:${session.demoSessionId}`);
    clearCacheByPrefix(`employees:list:${session.demoSessionId}`);

    return Response.json(approval);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to process approval", 400);
  }
}
