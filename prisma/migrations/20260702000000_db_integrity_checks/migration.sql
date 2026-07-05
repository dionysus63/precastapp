-- DB-level integrity constraints for rules previously enforced only in app code.
-- CHECK constraints use NOT VALID so existing rows are never rejected; they are
-- enforced for all new writes. Postgres validates them lazily if VALIDATE
-- CONSTRAINT is run later.

-- Stock is tracked in whole units and can never be negative.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_currentStockQuantity_nonneg"
  CHECK ("currentStockQuantity" >= 0) NOT VALID;

-- The inventory ledger only accepts whole-unit magnitudes (the Int balance
-- column cannot represent fractions).
ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_quantityChange_integral"
  CHECK ("quantityChange" = trunc("quantityChange")) NOT VALID;

-- Line quantities must be positive.
ALTER TABLE "QuoteLineItem"
  ADD CONSTRAINT "QuoteLineItem_quantity_positive"
  CHECK ("quantity" > 0) NOT VALID;

ALTER TABLE "DeliveryTicketLineItem"
  ADD CONSTRAINT "DeliveryTicketLineItem_quantity_positive"
  CHECK ("quantity" > 0) NOT VALID;

ALTER TABLE "InvoiceLineItem"
  ADD CONSTRAINT "InvoiceLineItem_quantity_positive"
  CHECK ("quantity" > 0) NOT VALID;

-- AppSettings is a singleton by convention; make the convention a rule.
ALTER TABLE "AppSettings"
  ADD CONSTRAINT "AppSettings_singleton"
  CHECK ("id" = 'default') NOT VALID;

-- At most one primary contact per customer. Deduplicate first (keep the
-- earliest-created primary), since the pre-transaction set-primary action
-- could historically produce two.
UPDATE "Contact" SET "isPrimary" = false
WHERE "isPrimary" = true
  AND "id" NOT IN (
    SELECT DISTINCT ON ("customerId") "id"
    FROM "Contact"
    WHERE "isPrimary" = true
    ORDER BY "customerId", "createdAt" ASC, "id" ASC
  );

CREATE UNIQUE INDEX "Contact_one_primary_per_customer"
  ON "Contact" ("customerId")
  WHERE "isPrimary" = true;

-- At most one default price list. Keep the most recently updated default.
UPDATE "PriceList" SET "isDefault" = false
WHERE "isDefault" = true
  AND "id" NOT IN (
    SELECT "id"
    FROM "PriceList"
    WHERE "isDefault" = true
    ORDER BY "updatedAt" DESC, "id" ASC
    LIMIT 1
  );

CREATE UNIQUE INDEX "PriceList_one_default"
  ON "PriceList" ("isDefault")
  WHERE "isDefault" = true;
