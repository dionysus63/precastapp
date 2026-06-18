-- Migrate existing Product rows from the old schema to the current Prisma schema.
-- Safe to run once on databases that still have productName / subcategory columns.

DO $$ BEGIN
  CREATE TYPE "ProductType" AS ENUM (
    'STOCK',
    'CONFIGURABLE',
    'CUSTOM_STRUCTURE',
    'SERVICE',
    'MATERIAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProductDocumentType" AS ENUM (
    'GENERIC_SUBMITTAL',
    'SHOP_DRAWING',
    'CUT_SHEET_TEMPLATE',
    'SPEC_SHEET',
    'INSTALLATION_INSTRUCTIONS',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Product' AND column_name = 'productName'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Product' AND column_name = 'name'
  ) THEN
    ALTER TABLE "Product" RENAME COLUMN "productName" TO "name";
  END IF;
END $$;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "description" TEXT;

UPDATE "Product"
SET "description" = "subcategory"
WHERE "subcategory" IS NOT NULL
  AND ("description" IS NULL OR "description" = '');

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "productType" "ProductType" NOT NULL DEFAULT 'STOCK';

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "cost" DECIMAL(12, 2);

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "taxable" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "yardLocation" TEXT;

ALTER TABLE "Product" DROP COLUMN IF EXISTS "subcategory";

CREATE TABLE IF NOT EXISTS "ProductDocument" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "documentType" "ProductDocumentType" NOT NULL,
  "documentName" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "notes" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductDocument_productId_idx"
ON "ProductDocument"("productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductDocument_productId_fkey'
  ) THEN
    ALTER TABLE "ProductDocument"
    ADD CONSTRAINT "ProductDocument_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
