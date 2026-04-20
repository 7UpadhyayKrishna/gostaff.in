import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { clearCacheByPrefix } from "@/src/lib/response-cache";
import { apiError } from "@/src/lib/api-error";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can resubmit for approval");
    const { id } = await params;

    const employee = await prisma.employee.findFirst({
      where: { id, demoSessionId: session.demoSessionId },
      include: { approval: true },
    });

    if (!employee) return apiError("Employee not found", 404);
    if (employee.status !== "CONDITIONALLY_APPROVED") {
      return apiError("Only employees flagged by Ops can be resubmitted.", 400);
    }
    if (!employee.approval || employee.approval.status !== "CONDITIONALLY_APPROVED") {
      return apiError("No conditional approval to clear.", 400);
    }

    await prisma.$transaction([
      prisma.employee.update({
        where: { id: employee.id },
        data: { status: "PENDING_APPROVAL" },
      }),
      prisma.approval.update({
        where: { id: employee.approval.id },
        data: {
          status: "PENDING",
          note: null,
          submittedAt: new Date(),
          decidedAt: null,
        },
      }),
    ]);

    clearCacheByPrefix(`approvals:list:${session.demoSessionId}`);
    clearCacheByPrefix(`employees:list:${session.demoSessionId}`);

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to resubmit for approval", 400);
  }
}
