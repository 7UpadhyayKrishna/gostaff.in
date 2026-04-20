import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

export async function GET() {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "OWNER"], "Only HR, Operation, or Owner can view supervisors");

    const supervisors = await prisma.user.findMany({
      where: { demoSessionId: session.demoSessionId, role: "SITE_SUPERVISOR" },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(supervisors);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch supervisors", 400);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can create supervisors");
    const body = (await req.json()) as { name?: string; email?: string; password?: string };

    if (!body.name || !body.email || !body.password) {
      return apiError("name, email and password are required", 400);
    }

    const supervisor = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        passwordHash: await bcrypt.hash(body.password, 10),
        role: "SITE_SUPERVISOR",
        demoSessionId: session.demoSessionId,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return Response.json(supervisor, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to create supervisor user", 400);
  }
}
