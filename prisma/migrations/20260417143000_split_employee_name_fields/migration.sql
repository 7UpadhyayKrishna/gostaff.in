-- AlterTable
ALTER TABLE "Employee"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "middleName" TEXT,
ADD COLUMN "lastName" TEXT;

-- Backfill split name fields from existing fullName values.
UPDATE "Employee"
SET
  "firstName" = COALESCE(NULLIF(split_part(trim("fullName"), ' ', 1), ''), 'Draft'),
  "middleName" = NULL,
  "lastName" = COALESCE(
    NULLIF(regexp_replace(trim("fullName"), '^\S+\s*', ''), ''),
    COALESCE(NULLIF(split_part(trim("fullName"), ' ', 1), ''), 'Employee')
  );

-- Enforce required columns after backfill.
ALTER TABLE "Employee"
ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;
