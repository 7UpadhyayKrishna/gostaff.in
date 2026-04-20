import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { clearCacheByPrefix } from "@/src/lib/response-cache";
import { apiError } from "@/src/lib/api-error";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "SITE_SUPERVISOR", "OWNER"]);
    const p = await params;
    const employee = await prisma.employee.findFirst({
      where: {
        id: p.id,
        demoSessionId: session.demoSessionId,
        ...(session.role === "SITE_SUPERVISOR"
          ? {
              siteAssignment: {
                site: {
                  supervisorUserId: session.userId,
                },
              },
            }
          : {}),
      },
      include: { documents: true, payrollConfig: true, siteAssignment: { include: { site: true } }, approval: true, exitRecord: true },
    });
    if (!employee) return apiError("Employee not found", 404);
    if (session.role === "SITE_SUPERVISOR") return Response.json({ ...employee, payrollConfig: null, payslips: [] });
    return Response.json(employee);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch employee", 400);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can update employees");
    const p = await params;
    const body = await req.json();
    const employee = await prisma.employee.findFirst({
      where: { id: p.id, demoSessionId: session.demoSessionId },
      select: { status: true },
    });
    if (!employee) return apiError("Employee not found", 404);
    if (employee.status === "EXITED") return apiError("Exited employee records are archived and read-only.", 409);
    const updated = await prisma.employee.updateMany({ where: { id: p.id, demoSessionId: session.demoSessionId }, data: body });
    clearCacheByPrefix(`employees:list:${session.demoSessionId}`);
    return Response.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to update employee", 400);
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can delete employees");
    const p = await params;
    const employee = await prisma.employee.findFirst({
      where: { id: p.id, demoSessionId: session.demoSessionId },
      select: { status: true },
    });
    if (!employee) return apiError("Employee not found", 404);
    if (employee.status === "EXITED") return apiError("Exited employee records are archived and cannot be deleted.", 409);
    await prisma.employee.deleteMany({ where: { id: p.id, demoSessionId: session.demoSessionId } });
    clearCacheByPrefix(`employees:list:${session.demoSessionId}`);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to delete employee", 400);
  }
}
