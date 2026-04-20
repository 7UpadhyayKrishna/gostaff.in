import { prisma } from "@/src/lib/prisma";
import { createDemoSession } from "@/src/lib/demo-session";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

export async function POST() {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR admin can reset demo data");

    await prisma.demoSession.deleteMany({ where: { id: session.demoSessionId } });
    const newSession = await createDemoSession();

    return Response.json({ ok: true, sessionId: newSession.id });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to reset demo", 400);
  }
}
