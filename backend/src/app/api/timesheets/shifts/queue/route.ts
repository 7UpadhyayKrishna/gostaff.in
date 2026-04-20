import { apiError } from "@/src/lib/api-error";
import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";

export async function GET(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["OPS_DIRECTOR", "HR_ADMIN", "OWNER", "SITE_SUPERVISOR"]);
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const siteId = url.searchParams.get("siteId");
    const shiftId = url.searchParams.get("shiftId");
    const status = url.searchParams.get("status") ?? "SUBMITTED";

    const queue = await prisma.shiftTimesheetSubmission.findMany({
      where: {
        demoSessionId: session.demoSessionId,
        ...(date ? { date: new Date(`${date}T00:00:00.000Z`) } : {}),
        ...(siteId ? { siteId } : {}),
        ...(shiftId ? { shiftId } : {}),
        ...(status ? { status: status as any } : {}),
        ...(session.role === "SITE_SUPERVISOR" ? { site: { supervisorUserId: session.userId } } : {}),
      },
      select: {
        id: true,
        date: true,
        status: true,
        submittedAt: true,
        approvedAt: true,
        rejectedAt: true,
        rejectionRemark: true,
        site: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        lineItems: {
          select: {
            id: true,
            employeeId: true,
            attendanceStatus: true,
            hoursWorked: true,
            overtime: true,
            manualHoursOverride: true,
            employee: { select: { employeeId: true, fullName: true } },
          },
          orderBy: { employee: { fullName: "asc" } },
        },
      },
      orderBy: [{ date: "desc" }, { site: { name: "asc" } }, { shift: { startTime: "asc" } }],
    });
    return Response.json(queue);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch shift validation queue", 400);
  }
}
