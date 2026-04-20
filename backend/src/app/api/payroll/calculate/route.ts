import { buildSettlement } from "@/src/lib/calculations/settlement";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can run payroll calculations");
    const body = await req.json();
    return Response.json(
      buildSettlement({
        contractStart: new Date(body.contractStart),
        lastWorkingDay: new Date(body.lastWorkingDay),
        basicSalary: body.basicSalary,
        exitReason: body.exitReason,
        unusedLeaveDays: body.unusedLeaveDays ?? 0,
        finalMonthSalary: body.finalMonthSalary ?? 0,
        otherDeductions: body.otherDeductions ?? 0,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to calculate payroll data", 400);
  }
}
