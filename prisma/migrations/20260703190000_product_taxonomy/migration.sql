-- CreateEnum
CREATE TYPE "ProductCategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultProductKind" "ProductKind",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSubcategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSubcategory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
ADD COLUMN IF NOT EXISTS "subcategoryId" TEXT,
ADD COLUMN IF NOT EXISTS "madeToOrder" BOOLEAN NOT NULL DEFAULT false;

-- Fix any negative stock that would block constraint validation during ALTER
UPDATE "Product" SET "currentStockQuantity" = 0 WHERE "currentStockQuantity" < 0;

-- Seed default categories
INSERT INTO "ProductCategory" ("id", "name", "sortOrder", "status", "defaultProductKind", "createdAt", "updatedAt") VALUES
  ('pcat_vaults', 'Vaults', 1, 'ACTIVE', 'STANDARD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_manholes', 'Manholes', 2, 'ACTIVE', 'STANDARD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_walls', 'Walls', 3, 'ACTIVE', 'STANDARD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_slabs', 'Slabs', 4, 'ACTIVE', 'STANDARD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_drainage', 'Drainage', 5, 'ACTIVE', 'STANDARD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_accessories', 'Accessories', 6, 'ACTIVE', 'STANDARD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_castings', 'Castings', 7, 'ACTIVE', 'CASTING_ASSEMBLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_pipes', 'Pipes', 8, 'ACTIVE', 'PIPE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pcat_rings', 'Rings', 9, 'ACTIVE', 'DRAIN_RING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed default subcategories
INSERT INTO "ProductSubcategory" ("id", "categoryId", "name", "sortOrder", "createdAt", "updatedAt") VALUES
  ('psub_vaults_traffic', 'pcat_vaults', 'Traffic Rated', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_vaults_standard', 'pcat_vaults', 'Standard Duty', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_vaults_light', 'pcat_vaults', 'Light Duty', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_manholes_riser', 'pcat_manholes', 'Riser', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_manholes_cone', 'pcat_manholes', 'Cone', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_manholes_base', 'pcat_manholes', 'Base Section', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_manholes_san', 'pcat_manholes', 'Sanitary Sewer', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_walls_h6', 'pcat_walls', 'H6 Panel', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_walls_h8', 'pcat_walls', 'H8 Panel', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_walls_corner', 'pcat_walls', 'Corner Panel', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_slabs_pad', 'pcat_slabs', 'Equipment Pad', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_slabs_sidewalk', 'pcat_slabs', 'Sidewalk Slab', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_drainage_catch', 'pcat_drainage', 'Catch Basin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_drainage_san', 'pcat_drainage', 'Sanitary Sewer', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_accessories_lift', 'pcat_accessories', 'Lifting Hardware', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_accessories_conn', 'pcat_accessories', 'Connection Hardware', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_accessories_fabric', 'pcat_accessories', 'Filter Fabric', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_castings_traffic', 'pcat_castings', 'Traffic Rated', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_castings_san', 'pcat_castings', 'Sanitary', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_castings_water', 'pcat_castings', 'Water', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_castings_other', 'pcat_castings', 'Other', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_castings_standard', 'pcat_castings', 'Standard', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_castings_frame', 'pcat_castings', 'Frame', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_castings_cover', 'pcat_castings', 'Cover/Grate', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_pipes_precast', 'pcat_pipes', 'Precast RCP', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_pipes_ads', 'pcat_pipes', 'ADS Plastic', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_rings_4', 'pcat_rings', '4'' dia', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_rings_6', 'pcat_rings', '6'' dia', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_rings_8', 'pcat_rings', '8'' dia', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_rings_10', 'pcat_rings', '10'' dia', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('psub_rings_12', 'pcat_rings', '12'' dia', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert categories from existing products not in seed
INSERT INTO "ProductCategory" ("id", "name", "sortOrder", "status", "createdAt", "updatedAt")
SELECT
  'pcat_legacy_' || md5(trimmed_name),
  trimmed_name,
  100 + row_number() OVER (ORDER BY trimmed_name),
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT trim("category") AS trimmed_name
  FROM "Product"
  WHERE trim("category") <> ''
    AND NOT EXISTS (
      SELECT 1 FROM "ProductCategory" pc
      WHERE lower(pc."name") = lower(trim("Product"."category"))
    )
) legacy_categories;

-- Insert subcategories from existing product description values
INSERT INTO "ProductSubcategory" ("id", "categoryId", "name", "sortOrder", "createdAt", "updatedAt")
SELECT
  'psub_legacy_' || md5(pc."id" || '::' || pair.sub_name),
  pc."id",
  pair.sub_name,
  100 + row_number() OVER (PARTITION BY pc."id" ORDER BY pair.sub_name),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT
    trim(p."category") AS cat_name,
    trim(p."description") AS sub_name
  FROM "Product" p
  WHERE trim(p."category") <> ''
    AND p."description" IS NOT NULL
    AND trim(p."description") <> ''
) pair
JOIN "ProductCategory" pc ON lower(pc."name") = lower(pair.cat_name)
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductSubcategory" ps
  WHERE ps."categoryId" = pc."id"
    AND lower(ps."name") = lower(pair.sub_name)
);

-- Backfill categoryId from legacy category string
UPDATE "Product" p
SET "categoryId" = pc."id"
FROM "ProductCategory" pc
WHERE lower(pc."name") = lower(trim(p."category"));

-- Fallback for products with no matching category
INSERT INTO "ProductCategory" ("id", "name", "sortOrder", "status", "createdAt", "updatedAt")
SELECT 'pcat_uncategorized', 'Uncategorized', 999, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductCategory" WHERE "name" = 'Uncategorized'
);

UPDATE "Product"
SET "categoryId" = (SELECT "id" FROM "ProductCategory" WHERE "name" = 'Uncategorized')
WHERE "categoryId" IS NULL;

-- Backfill subcategoryId from legacy description (was subcategory storage)
UPDATE "Product" p
SET "subcategoryId" = ps."id"
FROM "ProductSubcategory" ps
JOIN "ProductCategory" pc ON pc."id" = ps."categoryId"
WHERE p."categoryId" = pc."id"
  AND p."description" IS NOT NULL
  AND trim(p."description") <> ''
  AND lower(ps."name") = lower(trim(p."description"));

-- Make categoryId required and drop legacy category column
ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "Product" DROP COLUMN "category";

-- Drop productCatalog from AppSettings
ALTER TABLE "AppSettings" DROP COLUMN "productCatalog";

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");
CREATE INDEX "ProductCategory_status_idx" ON "ProductCategory"("status");
CREATE INDEX "ProductCategory_sortOrder_idx" ON "ProductCategory"("sortOrder");
CREATE UNIQUE INDEX "ProductSubcategory_categoryId_name_key" ON "ProductSubcategory"("categoryId", "name");
CREATE INDEX "ProductSubcategory_categoryId_idx" ON "ProductSubcategory"("categoryId");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_subcategoryId_idx" ON "Product"("subcategoryId");

-- AddForeignKey
ALTER TABLE "ProductSubcategory" ADD CONSTRAINT "ProductSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "ProductSubcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
