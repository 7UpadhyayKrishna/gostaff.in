import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "OWNER"]);
    const { id } = await params;

    const record = await prisma.exitRecord.findFirst({
      where: { id, employee: { demoSessionId: session.demoSessionId } },
      include: { employee: true },
    });

    if (!record) return apiError("Exit record not found", 404);
    return Response.json(record);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch exit record", 400);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can update exit records");
    const { id } = await params;
    const body = await req.json();

    const record = await prisma.exitRecord.findFirst({
      where: { id, employee: { demoSessionId: session.demoSessionId } },
      include: { employee: { select: { status: true } } },
    });
    if (!record) return apiError("Exit record not found", 404);
    if (record.employee.status === "EXITED") {
      return apiError("Exited employees are archived and exit records are read-only.", 409);
    }

    const updated = await prisma.exitRecord.update({ where: { id }, data: body });
    return Response.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to update exit record", 400);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can complete exit processing");
    const { id } = await params;
    const body = (await req.json()) as { action?: string };

    const record = await prisma.exitRecord.findFirst({
      where: { id, employee: { demoSessionId: session.demoSessionId } },
      include: { employee: true },
    });

    if (!record) return apiError("Exit record not found", 404);
    if (record.employee.status === "EXITED") return apiError("Employee is already exited.", 409);
    if (body.action !== "COMPLETE") return Response.json({ ok: true });

    const missingChecklist: string[] = [];
    if (!record.accessCardReturned) missingChecklist.push("Equipment/access return not completed.");
    if (!record.financeCleared) missingChecklist.push("Final salary/finance clearance not completed.");
    if (!record.assetListCleared) missingChecklist.push("Documents/assets handover checklist not completed.");
    if (!record.hrInterviewDone) missingChecklist.push("Final HR closure checklist not completed.");
    const settlementCalculated =
      record.gratuityAmount != null &&
      record.gratuityDays != null &&
      record.totalSettlement != null;
    if (!settlementCalculated) {
      missingChecklist.push("Settlement/gratuity must be calculated before completion.");
    }
    if (missingChecklist.length > 0) {
      return Response.json(
        {
          success: false,
          error: "EXIT_COMPLETION_BLOCKED",
          message: "Exit cannot be completed until all checklist and settlement requirements are met.",
          blockers: missingChecklist.map((m) => ({ message: m })),
        },
        { status: 409 },
      );
    }

    const completed = await prisma.exitRecord.update({
      where: { id },
      data: { exitStatus: "COMPLETED", completedAt: new Date() },
    });

    await prisma.employee.update({ where: { id: record.employeeId }, data: { status: "EXITED" } });
    return Response.json(completed);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to complete exit process", 400);
  }
}
