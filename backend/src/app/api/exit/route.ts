import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

export async function GET() {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "OWNER"]);
    const records = await prisma.exitRecord.findMany({
      where: { employee: { demoSessionId: session.demoSessionId } },
      select: {
        id: true,
        employeeId: true,
        exitStatus: true,
        initiatedAt: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeId: true,
          },
        },
      },
      orderBy: { initiatedAt: "desc" },
    });
    return Response.json(records);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch exits", 400);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can initiate exits");
    const body = (await req.json()) as { employeeId: string; reason: "RESIGNATION" | "TERMINATION" | "CONTRACT_END" | "RETIREMENT"; raisedBy: "EMPLOYEE" | "HR"; lastWorkingDay: string };

    const employee = await prisma.employee.findFirst({
      where: { id: body.employeeId, demoSessionId: session.demoSessionId },
      select: { id: true, fullName: true, status: true },
    });

    if (!employee) return apiError("Employee not found", 404);
    if (employee.status === "EXITED") {
      return apiError("Exited employees are archived and cannot re-enter exit flow.", 409);
    }

    const blockers: Array<{ code: string; message: string }> = [];
    const activePayrollLinks = await prisma.payrollRun.count({
      where: {
        demoSessionId: session.demoSessionId,
        status: { in: ["COLLECTING", "VALIDATING", "READY_FOR_APPROVAL", "APPROVED", "EXPORTED"] },
        payslips: { some: { employeeId: employee.id } },
      },
    });
    if (activePayrollLinks > 0) {
      blockers.push({
        code: "ACTIVE_PAYROLL_LINK",
        message: "Employee is included in an active payroll run.",
      });
    }

    const openTimesheets = await prisma.timesheet.count({
      where: {
        employeeId: employee.id,
        status: { in: ["DRAFT", "SUBMITTED", "VALIDATED", "REJECTED"] },
      },
    });
    if (openTimesheets > 0) {
      blockers.push({
        code: "OPEN_TIMESHEETS",
        message: "Employee has open timesheets that must be locked before exit.",
      });
    }

    const docs = await prisma.document.findMany({
      where: {
        employeeId: employee.id,
        type: { in: ["PASSPORT", "EMIRATES_ID"] },
      },
      select: { type: true, fileUrl: true, uploadDeferredRemark: true },
    });
    const hasUsable = (type: "PASSPORT" | "EMIRATES_ID") =>
      docs.some((d) => d.type === type && (!!d.fileUrl || !!d.uploadDeferredRemark));
    if (!hasUsable("PASSPORT") || !hasUsable("EMIRATES_ID")) {
      blockers.push({
        code: "MISSING_MANDATORY_DOCUMENTS",
        message: "Passport and Emirates ID must be uploaded or formally deferred before exit.",
      });
    }

    if (blockers.length > 0) {
      return Response.json(
        {
          success: false,
          error: "EXIT_VALIDATION_FAILED",
          message: "Exit initiation is blocked until validation issues are resolved.",
          blockers,
        },
        { status: 409 },
      );
    }

    const record = await prisma.exitRecord.upsert({
      where: { employeeId: body.employeeId },
      update: {
        exitReason: body.reason,
        raisedBy: body.raisedBy,
        lastWorkingDay: new Date(body.lastWorkingDay),
        exitStatus: "CLEARANCE_PENDING",
      },
      create: {
        employeeId: body.employeeId,
        exitReason: body.reason,
        raisedBy: body.raisedBy,
        lastWorkingDay: new Date(body.lastWorkingDay),
        exitStatus: "CLEARANCE_PENDING",
      },
    });

    await prisma.employee.update({ where: { id: body.employeeId }, data: { status: "ON_EXIT" } });

    return Response.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to initiate exit", 400);
  }
}
