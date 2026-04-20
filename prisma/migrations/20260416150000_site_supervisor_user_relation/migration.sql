ALTER TABLE "Site" ADD COLUMN "supervisorUserId" TEXT;

UPDATE "Site" AS s
SET "supervisorUserId" = u."id"
FROM "User" AS u
WHERE u."name" = s."supervisorName"
  AND u."role" = 'SITE_SUPERVISOR';

ALTER TABLE "Site"
ADD CONSTRAINT "Site_supervisorUserId_fkey"
FOREIGN KEY ("supervisorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Site_supervisorUserId_idx" ON "Site"("supervisorUserId");

ALTER TABLE "Site" DROP COLUMN "supervisorName";
