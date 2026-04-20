-- Performance indexes for read-heavy dashboard/list queries
CREATE INDEX IF NOT EXISTS "Employee_demoSessionId_createdAt_idx"
ON "Employee" ("demoSessionId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Employee_demoSessionId_status_idx"
ON "Employee" ("demoSessionId", "status");

CREATE INDEX IF NOT EXISTS "Document_employeeId_expiryDate_idx"
ON "Document" ("employeeId", "expiryDate");

CREATE INDEX IF NOT EXISTS "Timesheet_employeeId_weekStart_idx"
ON "Timesheet" ("employeeId", "weekStart" DESC);

CREATE INDEX IF NOT EXISTS "Timesheet_employeeId_status_idx"
ON "Timesheet" ("employeeId", "status");

CREATE INDEX IF NOT EXISTS "Approval_managerId_submittedAt_idx"
ON "Approval" ("managerId", "submittedAt" DESC);

CREATE INDEX IF NOT EXISTS "User_demoSessionId_role_idx"
ON "User" ("demoSessionId", "role");
