-- Backfill default price list from Product.defaultPrice before dropping the column.

-- Ensure a default price list exists.
INSERT INTO "PriceList" ("id", "name", "isDefault", "notes", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'Standard ' || EXTRACT(YEAR FROM CURRENT_DATE)::text,
  true,
  'Auto-created during migration from product default prices.',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "PriceList" WHERE "isDefault" = true);

-- If no default but lists exist, mark the oldest as default.
UPDATE "PriceList"
SET "isDefault" = true
WHERE "id" = (
  SELECT "id" FROM "PriceList"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM "PriceList" WHERE "isDefault" = true);

-- Backfill PriceListItem rows from Product.defaultPrice for products missing an entry.
INSERT INTO "PriceListItem" ("id", "priceListId", "productId", "unitPrice", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  pl."id",
  p."id",
  p."defaultPrice",
  NOW(),
  NOW()
FROM "Product" p
CROSS JOIN (
  SELECT "id" FROM "PriceList" WHERE "isDefault" = true LIMIT 1
) pl
WHERE p."defaultPrice" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "PriceListItem" pli
    WHERE pli."priceListId" = pl."id" AND pli."productId" = p."id"
  );

-- Drop the legacy default price column.
ALTER TABLE "Product" DROP COLUMN "defaultPrice";
