import bcrypt from "bcryptjs";
import { ContractType, Department, DocumentType, JobTitle } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { clearCacheByPrefix } from "@/src/lib/response-cache";
import { composeFullName, parsePhoneInput, splitLegacyFullName } from "@/src/lib/identity-phone";
import { apiError } from "@/src/lib/api-error";

/** Stages: 1 Personal, 2 Employment, 3 Documents, 4 Payroll, 5 Approval note, 6 Confirmation (submit). */
const FINAL_ONBOARDING_STAGE = 6;

type StagePayload = {
  stage?: number;
  data?: Record<string, unknown>;
};

export async function GET(_: Request, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "OWNER"]);
    const { draftId } = await params;

    const employee = await prisma.employee.findFirst({
      where: { id: draftId, demoSessionId: session.demoSessionId },
      include: {
        documents: true,
        payrollConfig: true,
        siteAssignment: { include: { site: true } },
        approval: true,
      },
    });

    if (!employee) return apiError("Draft not found", 404);
    return Response.json(employee);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Failed to fetch draft", 400);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can edit onboarding workflow");
    const { draftId } = await params;
    const body = (await req.json()) as StagePayload;

    const draft = await prisma.employee.findFirst({ where: { id: draftId, demoSessionId: session.demoSessionId } });
    if (!draft) return apiError("Draft not found", 404);

    const stage = Math.max(1, Math.min(FINAL_ONBOARDING_STAGE, Number(body.stage ?? draft.onboardingStage + 1)));
    const movingPastEmployment = stage >= 3;
    const data = body.data ?? {};
    const payrollData = data.payroll as Record<string, unknown> | undefined;
    const submittingForApproval = stage === FINAL_ONBOARDING_STAGE;

    const effectiveJobTitle = (
      typeof data.jobTitle === "string" && data.jobTitle.trim() ? data.jobTitle : draft.jobTitle
    ) as JobTitle;

    if (submittingForApproval && effectiveJobTitle === "SUPERVISOR") {
      const emailRaw = typeof data.supervisorEmail === "string" ? data.supervisorEmail.trim().toLowerCase() : "";
      const password = typeof data.supervisorPassword === "string" ? data.supervisorPassword : "";
      if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        return apiError("Valid supervisor portal email is required for supervisor job title.", 400);
      }
      if (password.length < 6) {
        return apiError("Supervisor portal password must be at least 6 characters.", 400);
      }
      const dup = await prisma.user.findFirst({ where: { email: emailRaw } });
      if (dup) {
        return apiError("A user with this supervisor email already exists.", 409);
      }
    }

    if (submittingForApproval) {
      const docs = await prisma.document.findMany({
        where: { employeeId: draftId },
        select: { type: true, fileUrl: true, uploadDeferredRemark: true },
      });
      const docReady = (t: DocumentType) =>
        docs.some(
          (d) =>
            d.type === t &&
            ((d.fileUrl != null && String(d.fileUrl).trim().length > 0) ||
              (d.uploadDeferredRemark != null && String(d.uploadDeferredRemark).trim().length > 0)),
        );
      if (!docReady("PASSPORT") || !docReady("EMIRATES_ID")) {
        return Response.json(
          {
            error:
              "For passport and Emirates ID, upload the file or use “upload later” with a remark before submitting.",
          },
          { status: 400 },
        );
      }
    }

    const contractStartRaw = data.contractStart as string | undefined;
    const parsedContractStart =
      contractStartRaw && contractStartRaw.trim()
        ? new Date(contractStartRaw)
        : null;
    const safeContractStart =
      parsedContractStart && !Number.isNaN(parsedContractStart.getTime()) ? parsedContractStart : undefined;
    const nextContractTypeRaw = typeof data.contractType === "string" && data.contractType.trim() ? data.contractType : "";
    const nextContractType = (nextContractTypeRaw || draft.contractType) as ContractType;
    const contractEndRaw = typeof data.contractEnd === "string" ? data.contractEnd.trim() : "";
    const parsedContractEnd = contractEndRaw ? new Date(contractEndRaw) : null;
    const safeContractEnd = parsedContractEnd && !Number.isNaN(parsedContractEnd.getTime()) ? parsedContractEnd : null;
    if (contractEndRaw && !safeContractEnd) {
      return apiError("Contract expiry date is invalid.", 400);
    }

    if (movingPastEmployment && nextContractType === "LIMITED" && !safeContractEnd && !draft.contractEnd) {
      return apiError("Contract expiry date is required for limited contracts.", 400);
    }

    const incomingFirstName = typeof data.firstName === "string" ? data.firstName.trim() : "";
    const incomingMiddleName = typeof data.middleName === "string" ? data.middleName.trim() : "";
    const incomingLastName = typeof data.lastName === "string" ? data.lastName.trim() : "";
    const incomingFullName = typeof data.fullName === "string" ? data.fullName.trim() : "";
    const legacySplit = splitLegacyFullName(incomingFullName || draft.fullName);
    const firstName = incomingFirstName || draft.firstName || legacySplit.firstName || "Draft";
    const middleName = incomingMiddleName || draft.middleName || legacySplit.middleName || "";
    const lastName = incomingLastName || draft.lastName || legacySplit.lastName || "Employee";
    const fullName = composeFullName(firstName, middleName, lastName);

    const mobileValidation = parsePhoneInput({
      prefixInput: data.mobilePrefix,
      numberInput: data.mobileNumber,
      combinedInput: data.mobile,
      label: "Mobile number",
      fallbackPrefix: "+971",
      fallbackNumber: "500000000",
    });
    if (!mobileValidation.ok) {
      return apiError(mobileValidation.error, 400);
    }

    const emergencyValidation = parsePhoneInput({
      prefixInput: data.emergencyPhonePrefix,
      numberInput: data.emergencyPhoneNumber,
      combinedInput: data.emergencyPhone,
      label: "Emergency phone",
      fallbackPrefix: "+971",
      fallbackNumber: "500000001",
    });
    if (!emergencyValidation.ok) {
      return apiError(emergencyValidation.error, 400);
    }

    const employee = await prisma.employee.update({
      where: { id: draftId },
      data: {
        firstName,
        middleName: middleName || null,
        lastName,
        fullName,
        nationality: (data.nationality as string | undefined) ?? draft.nationality,
        mobile: mobileValidation.fullNumber,
        emergencyName: (data.emergencyName as string | undefined) ?? draft.emergencyName,
        emergencyPhone: emergencyValidation.fullNumber,
        ...(typeof data.jobTitle === "string" && data.jobTitle.trim() ? { jobTitle: data.jobTitle as JobTitle } : {}),
        ...(typeof data.department === "string" && data.department.trim() ? { department: data.department as Department } : {}),
        ...(typeof data.contractType === "string" && data.contractType.trim()
          ? { contractType: data.contractType as ContractType }
          : {}),
        ...(safeContractStart ? { contractStart: safeContractStart } : {}),
        ...(nextContractType === "UNLIMITED"
          ? { contractEnd: null }
          : contractEndRaw
            ? { contractEnd: safeContractEnd }
            : {}),
        onboardingStage: stage,
        status: submittingForApproval ? "PENDING_APPROVAL" : "DRAFT",
      },
    });

    if (payrollData && stage >= 4) {
      await prisma.payrollConfig.upsert({
        where: { employeeId: employee.id },
        update: {
          basicSalary: Number(payrollData.basicSalary ?? 1500),
          housingAllowance: Number(payrollData.housingAllowance ?? 0),
          transportAllowance: Number(payrollData.transportAllowance ?? 0),
          bankName: (payrollData.bankName as string | undefined) ?? null,
          iban: (payrollData.iban as string | undefined) ?? null,
        },
        create: {
          employeeId: employee.id,
          basicSalary: Number(payrollData.basicSalary ?? 1500),
          housingAllowance: Number(payrollData.housingAllowance ?? 0),
          transportAllowance: Number(payrollData.transportAllowance ?? 0),
          bankName: (payrollData.bankName as string | undefined) ?? null,
          iban: (payrollData.iban as string | undefined) ?? null,
          firstPayrollMonth: new Date().toISOString().slice(0, 7),
          gratuityStart: draft.contractStart,
        },
      });
    }

    if (submittingForApproval) {
      if (employee.jobTitle === "SUPERVISOR") {
        const emailRaw = typeof data.supervisorEmail === "string" ? data.supervisorEmail.trim().toLowerCase() : "";
        const password = typeof data.supervisorPassword === "string" ? data.supervisorPassword : "";
        if (emailRaw && password.length >= 6) {
          await prisma.user.create({
            data: {
              name: employee.fullName,
              email: emailRaw,
              passwordHash: await bcrypt.hash(password, 10),
              role: "SITE_SUPERVISOR",
              demoSessionId: session.demoSessionId,
            },
          });
        }
      }

      const manager = await prisma.user.findFirst({
        where: { demoSessionId: session.demoSessionId, role: "OPS_DIRECTOR" },
        select: { id: true },
      });

      if (manager) {
        await prisma.approval.upsert({
          where: { employeeId: employee.id },
          update: { status: "PENDING", note: null, submittedAt: new Date(), decidedAt: null },
          create: { employeeId: employee.id, managerId: manager.id, status: "PENDING" },
        });
      }
      clearCacheByPrefix(`approvals:list:${session.demoSessionId}`);
      clearCacheByPrefix(`employees:list:${session.demoSessionId}`);
    }

    return Response.json({ id: employee.id, stage, status: employee.status });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Failed to update onboarding draft", 400);
  }
}
