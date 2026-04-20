import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

export async function GET() {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "SITE_SUPERVISOR", "OWNER"]);

    const sites = await prisma.site.findMany({
      where: {
        ...(session.role === "SITE_SUPERVISOR" ? { supervisorUserId: session.userId } : {}),
      },
      include: {
        supervisor: { select: { id: true, name: true, email: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: { name: "asc" },
    });
    return Response.json(sites);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch sites", 400);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can create sites");
    const body = (await req.json()) as { name?: string; location?: string };

    if (!body.name || !body.location) return apiError("Site name and location are required", 400);

    const site = await prisma.site.create({
      data: { name: body.name.trim(), location: body.location.trim() },
      include: { supervisor: { select: { id: true, name: true, email: true } }, _count: { select: { assignments: true } } },
    });
    return Response.json(site, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to create site", 400);
  }
}
