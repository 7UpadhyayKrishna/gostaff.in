-- Create new role enum with revised roles
CREATE TYPE "UserRole_new" AS ENUM ('OWNER', 'OPS_DIRECTOR', 'HR_ADMIN', 'SITE_SUPERVISOR');

-- Drop default before type change
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

-- Map old roles to revised roles during cast
ALTER TABLE "User"
ALTER COLUMN "role" TYPE "UserRole_new"
USING (
  CASE
    WHEN "role"::text = 'MANAGER' THEN 'OPS_DIRECTOR'::"UserRole_new"
    WHEN "role"::text = 'FINANCE' THEN 'HR_ADMIN'::"UserRole_new"
    WHEN "role"::text = 'SUPER_ADMIN' THEN 'OWNER'::"UserRole_new"
    WHEN "role"::text = 'OWNER' THEN 'OWNER'::"UserRole_new"
    WHEN "role"::text = 'OPS_DIRECTOR' THEN 'OPS_DIRECTOR'::"UserRole_new"
    WHEN "role"::text = 'SITE_SUPERVISOR' THEN 'SITE_SUPERVISOR'::"UserRole_new"
    ELSE 'HR_ADMIN'::"UserRole_new"
  END
);

-- Swap enum types
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";

-- Restore default
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'HR_ADMIN';
