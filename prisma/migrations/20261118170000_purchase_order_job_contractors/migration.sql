-- Purchase orders: notes for the office only, the job the purchase is for
-- (a job on file or a typed name) and the contractors it is for (customers,
-- more than one allowed). None of it prints on the purchase order.
ALTER TABLE "PurchaseOrder"
  ADD COLUMN "internalNotes" TEXT,
  ADD COLUMN "jobId" TEXT,
  ADD COLUMN "jobName" TEXT,
  ADD COLUMN "contractorNames" TEXT;

CREATE INDEX "PurchaseOrder_jobId_idx" ON "PurchaseOrder"("jobId");

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PurchaseOrderContractor" (
    "purchaseOrderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderContractor_pkey" PRIMARY KEY ("purchaseOrderId","customerId")
);

CREATE INDEX "PurchaseOrderContractor_customerId_idx" ON "PurchaseOrderContractor"("customerId");

ALTER TABLE "PurchaseOrderContractor"
  ADD CONSTRAINT "PurchaseOrderContractor_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderContractor"
  ADD CONSTRAINT "PurchaseOrderContractor_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
