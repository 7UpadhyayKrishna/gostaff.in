import { prisma } from "@/src/lib/prisma";

export type ValidationBlocker = {
  code: string;
  message: string;
  count?: number;
  sample?: string[];
};

export async function getLockSiteBlockers(input: {
  demoSessionId: string;
  siteId: string;
  period: string;
}) {
  const mandatoryDocumentTypes = ["PASSPORT", "EMIRATES_ID"] as const;
  const assignedEmployees = await prisma.employee.findMany({
    where: {
      demoSessionId: input.demoSessionId,
      status: "ACTIVE",
      siteAssignment: { siteId: input.siteId },
    },
    select: { id: true, fullName: true },
  });

  if (assignedEmployees.length === 0) {
    return [
      {
        code: "NO_ASSIGNED_EMPLOYEES",
        message: "No active employees are assigned to this site.",
      } satisfies ValidationBlocker,
    ];
  }

  const employeeIds = assignedEmployees.map((e) => e.id);
  const docs = await prisma.document.findMany({
    where: {
      employeeId: { in: employeeIds },
      type: { in: [...mandatoryDocumentTypes] },
    },
    select: { employeeId: true, type: true, status: true, fileUrl: true, uploadDeferredRemark: true },
  });

  const blockers: ValidationBlocker[] = [];
  const expiredIds = new Set(
    docs.filter((d) => d.status === "EXPIRED" && mandatoryDocumentTypes.includes(d.type as (typeof mandatoryDocumentTypes)[number])).map((d) => d.employeeId),
  );
  if (expiredIds.size > 0) {
    blockers.push({
      code: "EXPIRED_MANDATORY_DOCUMENTS",
      message: "Some employees have expired passport or Emirates ID documents.",
      count: expiredIds.size,
      sample: assignedEmployees.filter((e) => expiredIds.has(e.id)).slice(0, 5).map((e) => e.fullName),
    });
  }

  const docsByEmployee = new Map<string, Set<string>>();
  for (const doc of docs) {
    const usable = !!doc.fileUrl || !!doc.uploadDeferredRemark;
    if (!usable) continue;
    if (!docsByEmployee.has(doc.employeeId)) docsByEmployee.set(doc.employeeId, new Set());
    docsByEmployee.get(doc.employeeId)!.add(doc.type);
  }
  const missingMandatory = assignedEmployees.filter((e) => {
    const seen = docsByEmployee.get(e.id) ?? new Set();
    return mandatoryDocumentTypes.some((type) => !seen.has(type));
  });
  if (missingMandatory.length > 0) {
    blockers.push({
      code: "MISSING_MANDATORY_DOCUMENTS",
      message: "Some employees are missing mandatory documents (passport and Emirates ID).",
      count: missingMandatory.length,
      sample: missingMandatory.slice(0, 5).map((e) => e.fullName),
    });
  }

  const unlockedTimesheets = await prisma.timesheet.count({
    where: {
      period: input.period,
      employeeId: { in: employeeIds },
      status: { in: ["DRAFT", "SUBMITTED", "VALIDATED", "REJECTED"] },
    },
  });
  if (unlockedTimesheets > 0) {
    blockers.push({
      code: "OPEN_TIMESHEETS",
      message: "Some timesheets are still open and not locked for this period.",
      count: unlockedTimesheets,
    });
  }

  const siteSubmission = await prisma.siteTimesheetSubmission.findUnique({
    where: {
      demoSessionId_siteId_period: {
        demoSessionId: input.demoSessionId,
        siteId: input.siteId,
        period: input.period,
      },
    },
    select: { status: true },
  });
  if (!siteSubmission || (siteSubmission.status !== "SUBMITTED" && siteSubmission.status !== "LOCKED")) {
    blockers.push({
      code: "SUPERVISOR_NOT_SUBMITTED",
      message: "Supervisor has not submitted timesheets for this site and period.",
    });
  }

  return blockers;
}

export async function getPayrollSubmitBlockers(input: {
  demoSessionId: string;
  payrollRunId: string;
  period: string;
}) {
  const blockers: ValidationBlocker[] = [];

  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: input.payrollRunId },
    select: {
      employeeId: true,
      employee: {
        select: {
          fullName: true,
          status: true,
          payrollConfig: { select: { paymentMethod: true, bankName: true, iban: true } },
        },
      },
    },
  });

  const missingWps = payslips.filter((p) => {
    const cfg = p.employee?.payrollConfig;
    if (!cfg) return true;
    if (cfg.paymentMethod !== "WPS_BANK") return false;
    return !cfg.bankName || !cfg.iban;
  });
  if (missingWps.length > 0) {
    blockers.push({
      code: "MISSING_WPS_BANK_DETAILS",
      message: "Some employees are missing required bank/WPS account details.",
      count: missingWps.length,
      sample: missingWps.slice(0, 5).map((p) => p.employee?.fullName ?? "Unknown"),
    });
  }

  const pendingApproval = payslips.filter((p) => p.employee?.status === "PENDING_APPROVAL");
  if (pendingApproval.length > 0) {
    blockers.push({
      code: "PENDING_APPROVAL_EMPLOYEES_INCLUDED",
      message: "Payroll includes employees still pending approval.",
      count: pendingApproval.length,
      sample: pendingApproval.slice(0, 5).map((p) => p.employee?.fullName ?? "Unknown"),
    });
  }

  const openTimesheets = await prisma.timesheet.count({
    where: {
      period: input.period,
      employee: { demoSessionId: input.demoSessionId },
      status: { in: ["DRAFT", "SUBMITTED", "VALIDATED", "REJECTED"] },
    },
  });
  if (openTimesheets > 0) {
    blockers.push({
      code: "OPEN_TIMESHEETS",
      message: "Some timesheets are still open for this payroll period.",
      count: openTimesheets,
    });
  }

  return blockers;
}
