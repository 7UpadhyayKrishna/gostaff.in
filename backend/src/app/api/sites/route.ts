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
    requireRoles(session, ["OPS_DIRECTOR"], "Only Operation can create sites");
    const body = (await req.json()) as { name?: string; location?: string };

    if (!body.name || !body.location) return apiError("Site name and location are required", 400);
    const siteName = body.name.trim();
    const siteLocation = body.location.trim();

    const site = await prisma.$transaction(async (tx) => {
      const createdSite = await tx.site.create({
        data: { name: siteName, location: siteLocation },
        include: {
          supervisor: { select: { id: true, name: true, email: true } },
          _count: { select: { assignments: true } },
        },
      });

      await tx.shift.createMany({
        data: [
          {
            demoSessionId: session.demoSessionId,
            siteId: createdSite.id,
            name: "MORNING",
            startTime: "06:00",
            endTime: "14:00",
          },
          {
            demoSessionId: session.demoSessionId,
            siteId: createdSite.id,
            name: "EVENING",
            startTime: "14:00",
            endTime: "22:00",
          },
          {
            demoSessionId: session.demoSessionId,
            siteId: createdSite.id,
            name: "NIGHT",
            startTime: "22:00",
            endTime: "06:00",
          },
        ],
      });

      return createdSite;
    });
    return Response.json(site, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to create site", 400);
  }
}
