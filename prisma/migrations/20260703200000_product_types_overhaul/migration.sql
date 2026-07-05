-- ProductType enum migration
CREATE TYPE "ProductType_new" AS ENUM (
  'STOCK_PRECAST',
  'CASTING',
  'ACCESSORY',
  'PRECAST_PIPE',
  'ADS_PIPE',
  'CONFIGURABLE',
  'SERVICE'
);

ALTER TABLE "Product" ADD COLUMN "productType_new" "ProductType_new";

UPDATE "Product" SET "productType_new" = CASE
  WHEN "productKind" IN ('CASTING_ASSEMBLY', 'CASTING_COMPONENT') THEN 'CASTING'::"ProductType_new"
  WHEN "productKind" = 'PIPE' THEN 'PRECAST_PIPE'::"ProductType_new"
  WHEN "productType"::text = 'CONFIGURABLE' THEN 'CONFIGURABLE'::"ProductType_new"
  WHEN "productType"::text = 'SERVICE' THEN 'SERVICE'::"ProductType_new"
  WHEN "categoryId" IN (SELECT "id" FROM "ProductCategory" WHERE lower("name") = 'accessories') THEN 'ACCESSORY'::"ProductType_new"
  ELSE 'STOCK_PRECAST'::"ProductType_new"
END;

ALTER TABLE "Product" DROP COLUMN "productType";
ALTER TABLE "Product" RENAME COLUMN "productType_new" TO "productType";
ALTER TABLE "Product" ALTER COLUMN "productType" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "productType" SET DEFAULT 'STOCK_PRECAST'::"ProductType_new";

DROP TYPE "ProductType";
ALTER TYPE "ProductType_new" RENAME TO "ProductType";

-- ProductKind: remove PIPE (must happen before enum recreation)
UPDATE "Product" SET "productKind" = 'STANDARD' WHERE "productKind" = 'PIPE';
UPDATE "ProductCategory" SET "defaultProductKind" = 'STANDARD' WHERE "defaultProductKind" = 'PIPE';
UPDATE "ProductCategory" SET "defaultProductKind" = NULL WHERE "defaultProductKind"::text = 'PIPE';

CREATE TYPE "ProductKind_new" AS ENUM (
  'STANDARD',
  'DRAIN_RING',
  'CASTING_ASSEMBLY',
  'CASTING_COMPONENT'
);

ALTER TABLE "Product" ALTER COLUMN "productKind" DROP DEFAULT;
ALTER TABLE "ProductCategory" ALTER COLUMN "defaultProductKind" TYPE "ProductKind_new"
  USING ("defaultProductKind"::text::"ProductKind_new");

ALTER TABLE "Product" ALTER COLUMN "productKind" TYPE "ProductKind_new"
  USING ("productKind"::text::"ProductKind_new");
ALTER TABLE "Product" ALTER COLUMN "productKind" SET DEFAULT 'STANDARD'::"ProductKind_new";

DROP TYPE "ProductKind";
ALTER TYPE "ProductKind_new" RENAME TO "ProductKind";

-- ProductCategory.productType
ALTER TABLE "ProductCategory" ADD COLUMN "productType" "ProductType";

UPDATE "ProductCategory" SET "productType" = CASE
  WHEN lower("name") = 'castings' THEN 'CASTING'::"ProductType"
  WHEN lower("name") = 'pipes' THEN 'PRECAST_PIPE'::"ProductType"
  WHEN lower("name") = 'accessories' THEN 'ACCESSORY'::"ProductType"
  WHEN lower("name") = 'rings' THEN 'STOCK_PRECAST'::"ProductType"
  ELSE 'STOCK_PRECAST'::"ProductType"
END;

ALTER TABLE "ProductCategory" ALTER COLUMN "productType" SET NOT NULL;

CREATE INDEX "ProductCategory_productType_idx" ON "ProductCategory"("productType");

-- Seed ADS Pipe category
INSERT INTO "ProductCategory" ("id", "name", "productType", "sortOrder", "status", "defaultProductKind", "createdAt", "updatedAt")
VALUES (
  'pcat_ads_pipe',
  'ADS Pipe',
  'ADS_PIPE',
  10,
  'ACTIVE',
  'STANDARD',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE SET
  "productType" = 'ADS_PIPE'::"ProductType",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ProductSubcategory" ("id", "categoryId", "name", "sortOrder", "createdAt", "updatedAt")
SELECT 'psub_ads_std', 'pcat_ads_pipe', 'Standard', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "ProductCategory" WHERE "id" = 'pcat_ads_pipe')
  AND NOT EXISTS (SELECT 1 FROM "ProductSubcategory" WHERE "id" = 'psub_ads_std');

-- Clear defaultProductKind PIPE references on categories
UPDATE "ProductCategory" SET "defaultProductKind" = 'STANDARD' WHERE "defaultProductKind" IS NULL AND lower("name") IN ('pipes', 'ads pipe');

-- Re-sync product types from category where helpful
UPDATE "Product" p
SET "productType" = c."productType"
FROM "ProductCategory" c
WHERE p."categoryId" = c."id"
  AND p."productType" IN ('STOCK_PRECAST', 'ACCESSORY', 'PRECAST_PIPE', 'ADS_PIPE')
  AND p."productKind" = 'STANDARD';

-- ADS products by subcategory name
UPDATE "Product" p
SET "productType" = 'ADS_PIPE'::"ProductType"
FROM "ProductSubcategory" s
WHERE p."subcategoryId" = s."id"
  AND lower(s."name") LIKE '%ads%';

-- Inventory: physical products tracked; service/configurable and parts-based assemblies not
UPDATE "Product" SET "trackInventory" = false
WHERE "productType" IN ('SERVICE', 'CONFIGURABLE');

UPDATE "Product" SET "trackInventory" = false
WHERE "productKind" = 'CASTING_ASSEMBLY' AND "castingSoldAsUnit" = false;

UPDATE "Product" SET "trackInventory" = true
WHERE "productType" IN ('STOCK_PRECAST', 'CASTING', 'ACCESSORY', 'PRECAST_PIPE', 'ADS_PIPE')
  AND NOT ("productKind" = 'CASTING_ASSEMBLY' AND "castingSoldAsUnit" = false);

-- Drop madeToOrder
ALTER TABLE "Product" DROP COLUMN IF EXISTS "madeToOrder";

-- Drop sell area tables
DROP TABLE IF EXISTS "ProductCastingSellArea";
DROP TABLE IF EXISTS "CastingSellArea";
DROP TYPE IF EXISTS "CastingSellAreaStatus";
