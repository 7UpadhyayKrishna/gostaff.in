import { prisma } from "@/src/lib/prisma";
import { buildSettlement } from "@/src/lib/calculations/settlement";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can compute settlements");
    const { id } = await params;

    const record = await prisma.exitRecord.findFirst({
      where: { id, employee: { demoSessionId: session.demoSessionId } },
      include: { employee: { include: { payrollConfig: true } } },
    });

    if (!record || !record.employee.payrollConfig) {
      return apiError("Missing settlement data", 400);
    }

    const settlement = buildSettlement({
      contractStart: record.employee.contractStart,
      lastWorkingDay: record.lastWorkingDay,
      basicSalary: record.employee.payrollConfig.basicSalary,
      exitReason: record.exitReason,
      unusedLeaveDays: record.unusedLeaveDays ?? 0,
      finalMonthSalary: record.finalMonthSalary ?? record.employee.payrollConfig.basicSalary,
      otherDeductions: record.otherDeductions ?? 0,
    });

    await prisma.exitRecord.update({
      where: { id: record.id },
      data: {
        financeCleared: true,
        hrInterviewDone: true,
        gratuityDays: settlement.finalGratuityDays,
        gratuityAmount: settlement.gratuityAmount,
        leaveEncashment: settlement.leaveEncashment,
        finalMonthSalary: settlement.finalMonthSalary,
        otherDeductions: settlement.otherDeductions,
        totalSettlement: settlement.totalSettlement,
        exitStatus: "SETTLEMENT_PENDING",
      },
    });

    return Response.json(settlement);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to compute settlement", 400);
  }
}
