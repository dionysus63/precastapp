-- Purchase orders: more than one job. The single job of the migration before
-- this one (jobId, jobName) moves to rows of PurchaseOrderJob, each a job on
-- file or a typed name. PurchaseOrder keeps the names joined in one column
-- (jobNames, was jobName) for the list to sort and search by.
CREATE TABLE "PurchaseOrderJob" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "jobId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderJob_purchaseOrderId_idx" ON "PurchaseOrderJob"("purchaseOrderId");

CREATE INDEX "PurchaseOrderJob_jobId_idx" ON "PurchaseOrderJob"("jobId");

ALTER TABLE "PurchaseOrderJob"
  ADD CONSTRAINT "PurchaseOrderJob_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderJob"
  ADD CONSTRAINT "PurchaseOrderJob_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every order that already names a job keeps it, as its first job.
INSERT INTO "PurchaseOrderJob" ("id", "purchaseOrderId", "jobId", "name", "sortOrder")
SELECT
  'poj_' || md5(po."id"),
  po."id",
  po."jobId",
  COALESCE(NULLIF(btrim(po."jobName"), ''), j."jobNumber"),
  0
FROM "PurchaseOrder" po
LEFT JOIN "Job" j ON j."id" = po."jobId"
WHERE COALESCE(NULLIF(btrim(po."jobName"), ''), j."jobNumber") IS NOT NULL;

ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_jobId_fkey";

DROP INDEX "PurchaseOrder_jobId_idx";

ALTER TABLE "PurchaseOrder" DROP COLUMN "jobId";

ALTER TABLE "PurchaseOrder" RENAME COLUMN "jobName" TO "jobNames";
