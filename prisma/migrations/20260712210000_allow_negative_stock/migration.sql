-- Delivery completion deliberately allows tracked stock to go negative
-- ("deliver anyway, reconcile counts later" — see applyStockChange's
-- allowNegative in lib/inventory-service.ts). The non-negative CHECK from
-- 20260702000000_db_integrity_checks contradicted that policy: NOT VALID
-- checks still apply to new writes, so the first short-stock delivery would
-- fail with a raw constraint error. App code remains the guard for flows
-- that must not go negative (manual adjustments, inbound receipts).
ALTER TABLE "Product"
  DROP CONSTRAINT IF EXISTS "Product_currentStockQuantity_nonneg";
