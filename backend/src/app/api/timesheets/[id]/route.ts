import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

type ActionBody = { action?: "APPROVE" | "REJECT"; note?: string };

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["OPS_DIRECTOR"], "Only Operation can approve timesheets");
    const { id } = await params;
    const body = (await req.json()) as ActionBody;
    const status = body.action === "REJECT" ? "REJECTED" : "VALIDATED";

    const timesheet = await prisma.timesheet.findFirst({
      where: { id, employee: { demoSessionId: session.demoSessionId } },
      select: { id: true, status: true },
    });
    if (!timesheet) return apiError("Timesheet not found", 404);
    if (timesheet.status === "LOCKED") {
      return apiError("Timesheet is locked by HR and cannot be modified.", 409);
    }

    const updated = await prisma.timesheet.update({
      where: { id },
      data: {
        status,
        validatedAt: new Date(),
        validatedByUserId: session.userId,
        rejectionNote: body.action === "REJECT" ? body.note ?? "Rejected by Operation" : null,
      },
    });

    return Response.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to update timesheet status", 400);
  }
}
