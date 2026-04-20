import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { composeFullName, parsePhoneInput, splitLegacyFullName } from "@/src/lib/identity-phone";
import { ContractType, Prisma } from "@prisma/client";
import { apiError } from "@/src/lib/api-error";

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can start onboarding");
    const body = await req.json();
    const existingSession = await prisma.demoSession.findUnique({
      where: { id: session.demoSessionId },
      select: { id: true },
    });
    let validDemoSessionId = existingSession?.id ?? null;
    if (!validDemoSessionId) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { demoSessionId: true, demoSession: { select: { id: true } } },
      });
      validDemoSessionId = user?.demoSession?.id ?? null;
    }
    if (!validDemoSessionId) {
      return apiError("Session expired. Please sign out and sign in again.", 401);
    }

    const contractStart =
      typeof body.contractStart === "string" && body.contractStart.trim().length > 0
        ? new Date(body.contractStart)
        : new Date();
    const safeContractStart = Number.isNaN(contractStart.getTime()) ? new Date() : contractStart;
    const contractType = (typeof body.contractType === "string" && body.contractType.trim()
      ? body.contractType
      : "LIMITED") as ContractType;
    const contractEndRaw = typeof body.contractEnd === "string" ? body.contractEnd.trim() : "";
    const parsedContractEnd = contractEndRaw ? new Date(contractEndRaw) : null;
    const safeContractEnd =
      parsedContractEnd && !Number.isNaN(parsedContractEnd.getTime()) ? parsedContractEnd : null;
    if (contractEndRaw && !safeContractEnd) {
      return apiError("Contract expiry date is invalid.", 400);
    }

    const legacySplit = splitLegacyFullName(body.fullName);
    const firstName = (typeof body.firstName === "string" && body.firstName.trim()) || legacySplit.firstName || "Draft";
    const middleName = (typeof body.middleName === "string" && body.middleName.trim()) || legacySplit.middleName || "";
    const lastName = (typeof body.lastName === "string" && body.lastName.trim()) || legacySplit.lastName || "Employee";
    const fullName = composeFullName(firstName, middleName, lastName);

    const mobileValidation = parsePhoneInput({
      prefixInput: body.mobilePrefix,
      numberInput: body.mobileNumber,
      combinedInput: body.mobile,
      label: "Mobile number",
      fallbackPrefix: "+971",
      fallbackNumber: "500000000",
    });
    if (!mobileValidation.ok) {
      return apiError(mobileValidation.error, 400);
    }

    const emergencyValidation = parsePhoneInput({
      prefixInput: body.emergencyPhonePrefix,
      numberInput: body.emergencyPhoneNumber,
      combinedInput: body.emergencyPhone,
      label: "Emergency phone",
      fallbackPrefix: "+971",
      fallbackNumber: "500000001",
    });
    if (!emergencyValidation.ok) {
      return apiError(emergencyValidation.error, 400);
    }

    const employee = await prisma.employee.create({
      data: {
        employeeId: body.employeeId ?? `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        demoSessionId: validDemoSessionId,
        firstName,
        middleName: middleName || null,
        lastName,
        fullName,
        nationality: body.nationality ?? "Pakistani",
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : new Date("1990-01-01"),
        gender: body.gender ?? "MALE",
        mobile: mobileValidation.fullNumber,
        emergencyName: body.emergencyName ?? "Emergency Contact",
        emergencyPhone: emergencyValidation.fullNumber,
        jobTitle: body.jobTitle ?? "SECURITY_GUARD",
        department: body.department ?? "OPERATIONS",
        employmentType: body.employmentType ?? "FULL_TIME",
        contractType,
        contractStart: safeContractStart,
        contractEnd: contractType === "UNLIMITED" ? null : safeContractEnd,
        status: "DRAFT",
        onboardingStage: 1,
      },
    });

    return Response.json({ draftId: employee.id, stage: employee.onboardingStage });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return apiError("Employee ID conflict. Please try again.", 409);
      }
      if (error.code === "P2003") {
        return apiError("Session mismatch detected. Please refresh and sign in again.", 401);
      }
      return apiError(`Onboarding creation failed (${error.code})`, 400);
    }
    return apiError("Failed to start onboarding", 400);
  }
}
