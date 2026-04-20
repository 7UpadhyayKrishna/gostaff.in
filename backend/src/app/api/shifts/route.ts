import { prisma } from "@/src/lib/prisma";
import { apiError } from "@/src/lib/api-error";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";

type ShiftPayload = {
  siteId?: string;
  name?: string;
  startTime?: string;
  endTime?: string;
};

function isTimeString(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

export async function GET(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "SITE_SUPERVISOR", "OWNER"]);
    const url = new URL(req.url);
    const siteId = url.searchParams.get("siteId");
    const where = {
      demoSessionId: session.demoSessionId,
      isActive: true,
      ...(siteId ? { siteId } : {}),
      ...(session.role === "SITE_SUPERVISOR" ? { site: { supervisorUserId: session.userId } } : {}),
    };
    const shifts = await prisma.shift.findMany({
      where,
      orderBy: [{ site: { name: "asc" } }, { startTime: "asc" }],
      select: {
        id: true,
        siteId: true,
        name: true,
        startTime: true,
        endTime: true,
        createdAt: true,
      },
    });
    return Response.json(shifts);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch shifts", 400);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can create shifts");
    const body = (await req.json()) as ShiftPayload;
    if (!body.siteId || !body.name || !body.startTime || !body.endTime) {
      return apiError("siteId, name, startTime and endTime are required", 400);
    }
    if (!isTimeString(body.startTime) || !isTimeString(body.endTime)) {
      return apiError("startTime and endTime must be HH:MM", 400);
    }
    const shift = await prisma.shift.create({
      data: {
        demoSessionId: session.demoSessionId,
        siteId: body.siteId,
        name: body.name.trim(),
        startTime: body.startTime,
        endTime: body.endTime,
      },
    });
    return Response.json(shift, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to create shift", 400);
  }
}
