import { prisma } from "@/src/lib/prisma";
import { apiError } from "@/src/lib/api-error";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";

type ShiftUpdatePayload = {
  name?: string;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
};

function isTimeString(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can update shifts");
    const { id } = await params;
    const body = (await req.json()) as ShiftUpdatePayload;
    if ((body.startTime && !isTimeString(body.startTime)) || (body.endTime && !isTimeString(body.endTime))) {
      return apiError("startTime and endTime must be HH:MM", 400);
    }
    const updated = await prisma.shift.updateMany({
      where: { id, demoSessionId: session.demoSessionId },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
        ...(body.endTime !== undefined ? { endTime: body.endTime } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      },
    });
    if (!updated.count) return apiError("Shift not found", 404);
    const shift = await prisma.shift.findUnique({ where: { id } });
    return Response.json(shift);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to update shift", 400);
  }
}
