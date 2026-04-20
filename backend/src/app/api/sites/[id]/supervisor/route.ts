import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["OPS_DIRECTOR"], "Only Operation can assign supervisors");
    const { id } = await params;
    const body = (await req.json()) as { supervisorUserId?: string | null };

    if (body.supervisorUserId) {
      const supervisor = await prisma.user.findFirst({
        where: {
          id: body.supervisorUserId,
          demoSessionId: session.demoSessionId,
          role: "SITE_SUPERVISOR",
        },
        select: { id: true },
      });
      if (!supervisor) return apiError("Supervisor not found in this demo session", 404);
    }

    const site = await prisma.site.update({
      where: { id },
      data: { supervisorUserId: body.supervisorUserId ?? null },
      include: { supervisor: { select: { id: true, name: true, email: true } }, _count: { select: { assignments: true } } },
    });
    return Response.json(site);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to assign supervisor to site", 400);
  }
}
