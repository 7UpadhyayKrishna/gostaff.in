-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('HR_ADMIN', 'MANAGER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "JobTitle" AS ENUM ('SECURITY_GUARD', 'CLEANER', 'SUPERVISOR', 'DRIVER');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('OPERATIONS', 'FACILITIES');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('LIMITED', 'UNLIMITED');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'CONDITIONALLY_APPROVED', 'ACTIVE', 'REJECTED', 'ON_EXIT', 'EXITED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PASSPORT', 'EMIRATES_ID', 'RESIDENCE_VISA', 'LABOUR_CARD', 'OFFER_LETTER', 'SIGNED_CONTRACT', 'MEDICAL_FITNESS', 'BACKGROUND_CHECK');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'UPLOADED', 'EXPIRED', 'EXPIRING_SOON', 'CLEARED', 'FAILED');

-- CreateEnum
CREATE TYPE "VisaType" AS ENUM ('EMPLOYMENT', 'VISIT', 'FREELANCE');

-- CreateEnum
CREATE TYPE "ShiftPattern" AS ENUM ('MORNING', 'EVENING', 'NIGHT', 'ROTATING');

-- CreateEnum
CREATE TYPE "UniformSize" AS ENUM ('S', 'M', 'L', 'XL', 'XXL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WPS_BANK', 'CASH');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONDITIONALLY_APPROVED');

-- CreateEnum
CREATE TYPE "ExitReason" AS ENUM ('RESIGNATION', 'TERMINATION', 'CONTRACT_END', 'RETIREMENT');

-- CreateEnum
CREATE TYPE "ExitRaisedBy" AS ENUM ('EMPLOYEE', 'HR');

-- CreateEnum
CREATE TYPE "ExitStatus" AS ENUM ('INITIATED', 'CLEARANCE_PENDING', 'SETTLEMENT_PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "DemoSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'HR_ADMIN',
    "passwordHash" TEXT NOT NULL,
    "demoSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "demoSessionId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nickName" TEXT,
    "nationality" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "emergencyName" TEXT NOT NULL,
    "emergencyPhone" TEXT NOT NULL,
    "jobTitle" "JobTitle" NOT NULL,
    "department" "Department" NOT NULL,
    "reportingTo" TEXT,
    "employmentType" "EmploymentType" NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "contractStart" TIMESTAMP(3) NOT NULL,
    "contractEnd" TIMESTAMP(3),
    "probationMonths" INTEGER NOT NULL DEFAULT 6,
    "noticeDays" INTEGER NOT NULL DEFAULT 30,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "onboardingStage" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "visaType" "VisaType",
    "mohreRef" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "supervisorName" TEXT NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "shiftPattern" "ShiftPattern" NOT NULL,
    "shiftStart" TIMESTAMP(3) NOT NULL,
    "uniformSize" "UniformSize",
    "badgeNumber" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollConfig" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "housingAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transportAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherAllowances" JSONB,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'WPS_BANK',
    "bankName" TEXT,
    "iban" TEXT,
    "paymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "firstPayrollMonth" TEXT NOT NULL,
    "payrollGrade" TEXT,
    "gratuityStart" TIMESTAMP(3) NOT NULL,
    "leaveEntitlement" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "PayrollConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "exitReason" "ExitReason" NOT NULL,
    "raisedBy" "ExitRaisedBy" NOT NULL,
    "lastWorkingDay" TIMESTAMP(3) NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "accessCardReturned" BOOLEAN NOT NULL DEFAULT false,
    "uniformReturned" BOOLEAN NOT NULL DEFAULT false,
    "assetListCleared" BOOLEAN NOT NULL DEFAULT false,
    "itAccessRevoked" BOOLEAN NOT NULL DEFAULT false,
    "financeCleared" BOOLEAN NOT NULL DEFAULT false,
    "hrInterviewDone" BOOLEAN NOT NULL DEFAULT false,
    "gratuityDays" DOUBLE PRECISION,
    "gratuityAmount" DOUBLE PRECISION,
    "unusedLeaveDays" DOUBLE PRECISION,
    "leaveEncashment" DOUBLE PRECISION,
    "finalMonthSalary" DOUBLE PRECISION,
    "otherDeductions" DOUBLE PRECISION,
    "totalSettlement" DOUBLE PRECISION,
    "exitStatus" "ExitStatus" NOT NULL DEFAULT 'INITIATED',

    CONSTRAINT "ExitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "hoursWorked" DOUBLE PRECISION NOT NULL,
    "overtimeHrs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "allowances" DOUBLE PRECISION NOT NULL,
    "grossSalary" DOUBLE PRECISION NOT NULL,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL,
    "wpsStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteAssignment_employeeId_key" ON "SiteAssignment"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollConfig_employeeId_key" ON "PayrollConfig"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_employeeId_key" ON "Approval"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "ExitRecord_employeeId_key" ON "ExitRecord"("employeeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_demoSessionId_fkey" FOREIGN KEY ("demoSessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_demoSessionId_fkey" FOREIGN KEY ("demoSessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAssignment" ADD CONSTRAINT "SiteAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAssignment" ADD CONSTRAINT "SiteAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollConfig" ADD CONSTRAINT "PayrollConfig_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitRecord" ADD CONSTRAINT "ExitRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
