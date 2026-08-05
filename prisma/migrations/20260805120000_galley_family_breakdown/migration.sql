-- CreateEnum
CREATE TYPE "GalleyType" AS ENUM ('END', 'MIDDLE', 'CB');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "galleyFamilyCode" TEXT,
ADD COLUMN     "galleyType" "GalleyType";

-- AlterTable
ALTER TABLE "QuoteLineItem" ADD COLUMN     "galleyFamilyCode" TEXT;

-- CreateIndex
CREATE INDEX "Product_galleyFamilyCode_idx" ON "Product"("galleyFamilyCode");

-- Backfill: tag existing Storm Leaching Galley SKUs (LGD-*) with their
-- family code (product code minus the type suffix) and galley type.
UPDATE "Product" SET "galleyType" = 'CB',     "galleyFamilyCode" = left("productCode", -3)
WHERE "productCode" LIKE 'LGD-%-CB' AND name ILIKE '%leaching galley%';

UPDATE "Product" SET "galleyType" = 'MIDDLE', "galleyFamilyCode" = left("productCode", -2)
WHERE "productCode" LIKE 'LGD-%-M' AND name ILIKE '%leaching galley%';

UPDATE "Product" SET "galleyType" = 'END',    "galleyFamilyCode" = left("productCode", -2)
WHERE "productCode" LIKE 'LGD-%-E' AND name ILIKE '%leaching galley%';
