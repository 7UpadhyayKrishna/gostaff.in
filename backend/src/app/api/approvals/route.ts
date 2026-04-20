import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { getCachedValue } from "@/src/lib/response-cache";
import { apiError } from "@/src/lib/api-error";

export async function GET() {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "OWNER"]);
    const approvals = await getCachedValue(
      `approvals:list:${session.demoSessionId}`,
      5000,
      async () =>
        prisma.approval.findMany({
          where: { employee: { demoSessionId: session.demoSessionId } },
          select: {
            id: true,
            status: true,
            note: true,
            submittedAt: true,
            employee: {
              select: {
                fullName: true,
                employeeId: true,
                payrollConfig: { select: { basicSalary: true } },
              },
            },
            manager: { select: { id: true, name: true, email: true } },
          },
          orderBy: { submittedAt: "desc" },
        }),
    );

    return Response.json(approvals);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch approvals", 400);
  }
}
