import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can verify documents");
    const { id, docId } = await params;
    const body = (await req.json()) as { status?: string; note?: string };

    const doc = await prisma.document.findFirst({
      where: { id: docId, employeeId: id, employee: { demoSessionId: session.demoSessionId } },
      select: { id: true },
    });
    if (!doc) return apiError("Document not found", 404);

    const updated = await prisma.document.update({
      where: { id: docId },
      data: { status: body.status as any },
    });
    return Response.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to update document", 400);
  }
}
