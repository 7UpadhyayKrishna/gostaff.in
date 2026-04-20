import { apiError } from "@/src/lib/api-error";
import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { rebuildDailyPayrollLedgerForEmployeeDate } from "@/src/lib/shift-payroll";

type Body = { action?: "APPROVE" | "REJECT"; remark?: string };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["OPS_DIRECTOR"], "Only Operation can validate submitted shifts");
    const { id } = await params;
    const body = (await req.json()) as Body;
    const action = body.action;
    if (action !== "APPROVE" && action !== "REJECT") return apiError("action must be APPROVE or REJECT", 400);
    if (action === "REJECT" && !body.remark?.trim()) return apiError("remark is required for rejection", 400);

    const submission = await prisma.shiftTimesheetSubmission.findFirst({
      where: { id, demoSessionId: session.demoSessionId },
      include: { lineItems: true },
    });
    if (!submission) return apiError("Shift timesheet submission not found", 404);
    if (submission.status === "APPROVED") return apiError("Approved shift timesheet is locked", 409);
    if (submission.status !== "SUBMITTED" && submission.status !== "REJECTED") {
      return apiError("Only submitted shifts can be decided", 400);
    }

    if (action === "REJECT") {
      const rejected = await prisma.shiftTimesheetSubmission.update({
        where: { id: submission.id },
        data: {
          status: "REJECTED",
          rejectionRemark: body.remark?.trim() ?? "",
          rejectedAt: new Date(),
          approvedAt: null,
        },
      });
      return Response.json(rejected);
    }

    const approvedAt = new Date();
    const approved = await prisma.$transaction(async (tx) => {
      const updated = await tx.shiftTimesheetSubmission.update({
        where: { id: submission.id },
        data: {
          status: "APPROVED",
          approvedAt,
          approvedByUserId: session.userId,
          rejectionRemark: null,
          rejectedAt: null,
          lockedAt: approvedAt,
        },
      });

      for (const line of submission.lineItems) {
        await tx.payrollEntry.upsert({
          where: {
            shiftSubmissionId_employeeId: {
              shiftSubmissionId: submission.id,
              employeeId: line.employeeId,
            },
          },
          update: {
            date: submission.date,
            shiftId: submission.shiftId,
            hoursWorked: line.hoursWorked,
            overtime: line.overtime,
            source: "TIMESHEET",
            approvedAt,
            approvedByUserId: session.userId,
          },
          create: {
            demoSessionId: session.demoSessionId,
            employeeId: line.employeeId,
            date: submission.date,
            shiftId: submission.shiftId,
            shiftSubmissionId: submission.id,
            hoursWorked: line.hoursWorked,
            overtime: line.overtime,
            source: "TIMESHEET",
            approvedAt,
            approvedByUserId: session.userId,
          },
        });
      }
      return updated;
    });

    const employeeIds = [...new Set(submission.lineItems.map((line) => line.employeeId))];
    for (const employeeId of employeeIds) {
      await rebuildDailyPayrollLedgerForEmployeeDate(session.demoSessionId, employeeId, submission.date);
    }

    return Response.json(approved);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to decide shift timesheet", 400);
  }
}
