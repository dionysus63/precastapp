-- Purchase order numbers by vendor prefix (HA-0001): one counter row per prefix.
-- Existing purchase orders keep their PO10001 style numbers.
CREATE TABLE "PurchaseOrderPrefixSequence" (
    "prefix" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderPrefixSequence_pkey" PRIMARY KEY ("prefix")
);
