import { ShiftPattern } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { clearCacheByPrefix } from "@/src/lib/response-cache";
import { apiError } from "@/src/lib/api-error";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["OPS_DIRECTOR"], "Only Operation can assign employees to sites");
    const { id } = await params;
    const body = (await req.json()) as {
      siteId?: string;
      shiftPattern?: ShiftPattern;
      shiftStart?: string;
      uniformSize?: "S" | "M" | "L" | "XL" | "XXL" | null;
      badgeNumber?: string | null;
    };

    if (!body.siteId) return apiError("siteId is required", 400);
    if (!body.shiftPattern || !Object.values(ShiftPattern).includes(body.shiftPattern)) {
      return apiError("Valid shiftPattern is required", 400);
    }

    const employee = await prisma.employee.findFirst({
      where: { id, demoSessionId: session.demoSessionId },
      select: { id: true, status: true },
    });
    if (!employee) return apiError("Employee not found", 404);
    if (employee.status === "EXITED") {
      return apiError("Exited employees are archived and cannot be assigned to sites.", 409);
    }
    if (employee.status !== "ACTIVE") {
      return apiError("Only active employees can be assigned to a site.", 400);
    }

    const site = await prisma.site.findFirst({
      where: { id: body.siteId },
      select: { id: true },
    });
    if (!site) return apiError("Site not found", 404);

    const assignment = await prisma.siteAssignment.upsert({
      where: { employeeId: employee.id },
      update: {
        siteId: body.siteId,
        shiftPattern: body.shiftPattern,
        shiftStart: body.shiftStart ? new Date(body.shiftStart) : new Date(),
        uniformSize: body.uniformSize ?? null,
        badgeNumber: body.badgeNumber ?? null,
      },
      create: {
        employeeId: employee.id,
        siteId: body.siteId,
        shiftPattern: body.shiftPattern,
        shiftStart: body.shiftStart ? new Date(body.shiftStart) : new Date(),
        uniformSize: body.uniformSize ?? null,
        badgeNumber: body.badgeNumber ?? null,
      },
      include: { site: { select: { id: true, name: true, location: true, supervisor: { select: { id: true, name: true } } } } },
    });

    clearCacheByPrefix(`employees:list:${session.demoSessionId}`);
    clearCacheByPrefix(`compliance:list:${session.demoSessionId}`);
    return Response.json(assignment);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to assign site to employee", 400);
  }
}
