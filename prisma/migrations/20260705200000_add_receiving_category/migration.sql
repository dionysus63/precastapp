-- CreateEnum
CREATE TYPE "ReceivingCategory" AS ENUM ('RCP', 'ADS_PIPE', 'DOMESTIC_CASTINGS', 'IMPORTED_CASTINGS');

-- AlterTable
ALTER TABLE "PurchaseReceiptEntry" ADD COLUMN "category" "ReceivingCategory";

-- CreateIndex
CREATE INDEX "PurchaseReceiptEntry_category_receiptDate_idx" ON "PurchaseReceiptEntry"("category", "receiptDate");

-- Backfill existing casting receipts from supplier origin
UPDATE "PurchaseReceiptEntry" pre
SET "category" = CASE cs."origin"
  WHEN 'DOMESTIC' THEN 'DOMESTIC_CASTINGS'::"ReceivingCategory"
  WHEN 'IMPORTED' THEN 'IMPORTED_CASTINGS'::"ReceivingCategory"
  ELSE NULL
END
FROM "CastingSupplier" cs
WHERE pre."supplierId" = cs."id"
  AND pre."category" IS NULL;
