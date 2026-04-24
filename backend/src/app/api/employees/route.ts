import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { clearCacheByPrefix, getCachedValue } from "@/src/lib/response-cache";
import { composeFullName } from "@/src/lib/identity-phone";
import { apiError } from "@/src/lib/api-error";

type EmployeeInput = {
  employeeId?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName?: string;
  nickName?: string;
  nationality?: string;
  dateOfBirth?: string;
  gender?: string;
  mobile?: string;
  email?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  jobTitle?: string;
  department?: string;
  reportingTo?: string;
  employmentType?: string;
  contractType?: string;
  contractStart?: string;
  contractEnd?: string;
  probationMonths?: number | string;
  noticeDays?: number | string;
  status?: string;
  onboardingStage?: number | string;
};

const GENDER_VALUES = ["MALE", "FEMALE", "OTHER"] as const;
const JOB_TITLE_VALUES = ["SECURITY_GUARD", "CLEANER", "SUPERVISOR", "DRIVER"] as const;
const DEPARTMENT_VALUES = ["OPERATIONS", "FACILITIES"] as const;
const EMPLOYMENT_TYPE_VALUES = ["FULL_TIME", "PART_TIME", "CONTRACT"] as const;
const CONTRACT_TYPE_VALUES = ["LIMITED", "UNLIMITED"] as const;
const EMPLOYEE_STATUS_VALUES = ["DRAFT", "PENDING_APPROVAL", "CONDITIONALLY_APPROVED", "ACTIVE", "REJECTED", "ON_EXIT", "EXITED"] as const;

function normalizeEnum<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (allowed.includes(normalized as T[number])) {
    return normalized as T[number];
  }
  return fallback;
}

function parseOptionalDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseDateWithFallback(value: unknown, fallback: string) {
  return parseOptionalDate(value) ?? new Date(fallback);
}

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeEmployeeInput(input: EmployeeInput, index = 0) {
  const firstName = input.firstName?.trim() || "Draft";
  const middleName = input.middleName?.trim() || "";
  const lastName = input.lastName?.trim() || "Employee";
  const employeeId = input.employeeId?.trim() || `EMP-${Date.now()}-${index + 1}`;
  const fullName = input.fullName?.trim() || composeFullName(firstName, middleName, lastName);

  return {
    employeeId,
    firstName,
    middleName,
    lastName,
    fullName,
    nickName: input.nickName?.trim() || null,
    nationality: input.nationality?.trim() || "Pakistani",
    dateOfBirth: parseDateWithFallback(input.dateOfBirth, "1990-01-01"),
    gender: normalizeEnum(input.gender, GENDER_VALUES, "MALE"),
    mobile: input.mobile?.trim() || "+971500000000",
    email: input.email?.trim() || null,
    emergencyName: input.emergencyName?.trim() || "N/A",
    emergencyPhone: input.emergencyPhone?.trim() || "N/A",
    jobTitle: normalizeEnum(input.jobTitle, JOB_TITLE_VALUES, "SECURITY_GUARD"),
    department: normalizeEnum(input.department, DEPARTMENT_VALUES, "OPERATIONS"),
    reportingTo: input.reportingTo?.trim() || null,
    employmentType: normalizeEnum(input.employmentType, EMPLOYMENT_TYPE_VALUES, "FULL_TIME"),
    contractType: normalizeEnum(input.contractType, CONTRACT_TYPE_VALUES, "LIMITED"),
    contractStart: parseDateWithFallback(input.contractStart, new Date().toISOString()),
    contractEnd: parseOptionalDate(input.contractEnd),
    probationMonths: parsePositiveInt(input.probationMonths, 6),
    noticeDays: parsePositiveInt(input.noticeDays, 30),
    status: normalizeEnum(input.status, EMPLOYEE_STATUS_VALUES, "PENDING_APPROVAL"),
    onboardingStage: parsePositiveInt(input.onboardingStage, 1),
  };
}

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
    const bulkInputs = Array.isArray(body?.employees) ? (body.employees as EmployeeInput[]) : null;
    const singleInput = body as EmployeeInput;

    if (bulkInputs && bulkInputs.length === 0) {
      return apiError("Provide at least one employee for bulk creation", 400);
    }

    const normalized = bulkInputs ? bulkInputs.map((item, index) => normalizeEmployeeInput(item, index)) : [normalizeEmployeeInput(singleInput)];
    const manager = await prisma.user.findFirst({
      where: { demoSessionId: session.demoSessionId, role: "OPS_DIRECTOR" },
      select: { id: true },
    });

    const createdEmployees = await prisma.$transaction(
      normalized.map((employee) =>
        prisma.employee.create({
          data: {
            employeeId: employee.employeeId,
            demoSessionId: session.demoSessionId,
            firstName: employee.firstName,
            middleName: employee.middleName || null,
            lastName: employee.lastName,
            fullName: employee.fullName,
            nickName: employee.nickName,
            nationality: employee.nationality,
            dateOfBirth: employee.dateOfBirth,
            gender: employee.gender,
            mobile: employee.mobile,
            email: employee.email,
            emergencyName: employee.emergencyName,
            emergencyPhone: employee.emergencyPhone,
            jobTitle: employee.jobTitle,
            department: employee.department,
            reportingTo: employee.reportingTo,
            employmentType: employee.employmentType,
            contractType: employee.contractType,
            contractStart: employee.contractStart,
            contractEnd: employee.contractEnd,
            probationMonths: employee.probationMonths,
            noticeDays: employee.noticeDays,
            status: employee.status,
            onboardingStage: employee.onboardingStage,
          },
        }),
      ),
    );

    if (manager) {
      const pendingApprovals = createdEmployees
        .filter((employee) => employee.status === "PENDING_APPROVAL")
        .map((employee) => ({
          employeeId: employee.id,
          managerId: manager.id,
          status: "PENDING" as const,
        }));

      if (pendingApprovals.length > 0) {
        await prisma.approval.createMany({
          data: pendingApprovals,
          skipDuplicates: true,
        });
        clearCacheByPrefix(`approvals:list:${session.demoSessionId}`);
      }
    }

    clearCacheByPrefix(`employees:list:${session.demoSessionId}`);
    if (bulkInputs) {
      return Response.json({ createdCount: createdEmployees.length, employees: createdEmployees }, { status: 201 });
    }
    return Response.json(createdEmployees[0], { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to create employee", 400);
  }
}
