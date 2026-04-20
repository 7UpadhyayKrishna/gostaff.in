import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { clearCacheByPrefix, getCachedValue } from "@/src/lib/response-cache";
import { composeFullName } from "@/src/lib/identity-phone";
import { apiError } from "@/src/lib/api-error";

export async function GET() {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "SITE_SUPERVISOR", "OWNER"]);
    const data = await getCachedValue(
      `employees:list:${session.demoSessionId}`,
      8000,
      async () => {
        const rows = await prisma.employee.findMany({
          where: {
            demoSessionId: session.demoSessionId,
            status: { not: "EXITED" },
            ...(session.role === "SITE_SUPERVISOR"
              ? { siteAssignment: { site: { supervisorUserId: session.userId } } }
              : {}),
          },
          select: {
            id: true,
            employeeId: true,
            fullName: true,
            status: true,
            onboardingStage: true,
            contractStart: true,
            department: true,
            jobTitle: true,
            createdAt: true,
            payrollConfig: { select: { basicSalary: true } },
            siteAssignment: {
              select: {
                shiftPattern: true,
                shiftStart: true,
                site: { select: { id: true, name: true, location: true } },
              },
            },
            approval: { select: { status: true } },
            _count: { select: { documents: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        if (session.role === "SITE_SUPERVISOR") {
          return rows.map((row) => ({ ...row, payrollConfig: null }));
        }
        return rows;
      },
    );
    return Response.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch employees", 400);
  }
}
export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can create employees");
    const body = await req.json();
    const firstName = body.firstName ?? "Draft";
    const middleName = body.middleName ?? "";
    const lastName = body.lastName ?? "Employee";
    const employee = await prisma.employee.create({
      data: {
        employeeId: body.employeeId ?? `EMP-${Date.now()}`,
        demoSessionId: session.demoSessionId,
        firstName,
        middleName: middleName || null,
        lastName,
        fullName: body.fullName ?? composeFullName(firstName, middleName, lastName),
        nationality: body.nationality ?? "Pakistani",
        dateOfBirth: new Date("1990-01-01"),
        gender: "MALE",
        mobile: "+971500000000",
        emergencyName: "N/A",
        emergencyPhone: "N/A",
        jobTitle: "SECURITY_GUARD",
        department: "OPERATIONS",
        employmentType: "FULL_TIME",
        contractType: "LIMITED",
        contractStart: new Date(),
      },
    });
    clearCacheByPrefix(`employees:list:${session.demoSessionId}`);
    return Response.json(employee, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to create employee", 400);
  }
}
