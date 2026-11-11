-- Jobs list "My Open" tab: record who created each job, and let each user
-- pick which Jobs tab opens first.
CREATE TYPE "JobsDefaultTab" AS ENUM ('OPEN', 'MY_OPEN');

ALTER TABLE "User" ADD COLUMN "defaultJobsTab" "JobsDefaultTab" NOT NULL DEFAULT 'OPEN';

ALTER TABLE "Job" ADD COLUMN "createdById" TEXT;

CREATE INDEX "Job_createdById_idx" ON "Job"("createdById");

ALTER TABLE "Job" ADD CONSTRAINT "Job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Jobs made before this column existed have no recorded creator. Only the
-- owner has used the app so far, so they go to the first admin account.
UPDATE "Job"
SET "createdById" = (
  SELECT "id" FROM "User"
  WHERE "role" = 'ADMIN' AND "isActive"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
WHERE "createdById" IS NULL;
