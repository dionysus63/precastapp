-- Simplify job pipeline: drop LEAD/SUBMITTED/LOST/CANCELLED, add CLOSED.
-- Legacy rows map forward: early stages fold into QUOTING, terminal
-- non-complete states fold into CLOSED.
CREATE TYPE "JobStatus_new" AS ENUM ('QUOTING', 'AWARDED', 'ACTIVE', 'ON_HOLD', 'COMPLETE', 'CLOSED');
ALTER TABLE "Job" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Job" ALTER COLUMN "status" TYPE "JobStatus_new" USING (
  CASE "status"::text
    WHEN 'LEAD' THEN 'QUOTING'
    WHEN 'SUBMITTED' THEN 'QUOTING'
    WHEN 'LOST' THEN 'CLOSED'
    WHEN 'CANCELLED' THEN 'CLOSED'
    ELSE "status"::text
  END::"JobStatus_new"
);
ALTER TYPE "JobStatus" RENAME TO "JobStatus_old";
ALTER TYPE "JobStatus_new" RENAME TO "JobStatus";
DROP TYPE "JobStatus_old";
ALTER TABLE "Job" ALTER COLUMN "status" SET DEFAULT 'QUOTING';
