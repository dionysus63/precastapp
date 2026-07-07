-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultCategory" "ReceivingCategory",
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderSequence" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "category" "ReceivingCategory",
    "orderDate" DATE NOT NULL,
    "expectedDate" DATE,
    "vendorQuotePath" TEXT,
    "vendorQuoteName" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "enteredBy" TEXT,
    "submissionKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productId" TEXT,
    "itemCode" TEXT NOT NULL,
    "description" TEXT,
    "quantityOrdered" DECIMAL(12,4) NOT NULL,
    "quantityReceived" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'EA',
    "unitPrice" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PurchaseReceiptEntry" ADD COLUMN "purchaseOrderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_name_key" ON "Vendor"("name");

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE INDEX "Vendor_sortOrder_idx" ON "Vendor"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrderSequence_year_key" ON "PurchaseOrderSequence"("year");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_submissionKey_key" ON "PurchaseOrder"("submissionKey");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_category_idx" ON "PurchaseOrder"("category");

-- CreateIndex
CREATE INDEX "PurchaseOrder_orderDate_idx" ON "PurchaseOrder"("orderDate");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_productId_idx" ON "PurchaseOrderLine"("productId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptEntry_purchaseOrderId_idx" ON "PurchaseReceiptEntry"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "PurchaseReceiptEntry" ADD CONSTRAINT "PurchaseReceiptEntry_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed vendors from casting suppliers
INSERT INTO "Vendor" ("id", "name", "status", "defaultCategory", "notes", "sortOrder", "createdAt", "updatedAt")
SELECT
    cs."id",
    cs."name",
    CASE cs."status" WHEN 'ACTIVE' THEN 'ACTIVE'::"VendorStatus" ELSE 'INACTIVE'::"VendorStatus" END,
    CASE cs."origin"
        WHEN 'DOMESTIC' THEN 'DOMESTIC_CASTINGS'::"ReceivingCategory"
        WHEN 'IMPORTED' THEN 'IMPORTED_CASTINGS'::"ReceivingCategory"
    END,
    cs."notes",
    cs."sortOrder",
    cs."createdAt",
    cs."updatedAt"
FROM "CastingSupplier" cs
ON CONFLICT ("name") DO NOTHING;

-- Seed pipe vendors (use new ids if names don't exist)
INSERT INTO "Vendor" ("id", "name", "status", "defaultCategory", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Vianini', 'ACTIVE'::"VendorStatus", 'RCP'::"ReceivingCategory", 100, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Vendor" WHERE "name" = 'Vianini');

INSERT INTO "Vendor" ("id", "name", "status", "defaultCategory", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'ADS', 'ACTIVE'::"VendorStatus", 'ADS_PIPE'::"ReceivingCategory", 101, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Vendor" WHERE "name" = 'ADS');
