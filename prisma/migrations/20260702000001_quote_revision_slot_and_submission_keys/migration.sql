-- One revision slot per quote family: two concurrent "Revise" clicks can no
-- longer both create revision N. Original quotes (originalQuoteId NULL) are
-- unaffected — Postgres treats NULLs as distinct in unique indexes.
CREATE UNIQUE INDEX "Quote_originalQuoteId_revisionNumber_key"
  ON "Quote"("originalQuoteId", "revisionNumber");

-- Idempotency keys: a resubmitted inventory form reuses its key, so the
-- unique constraint turns a double-post into a no-op.
ALTER TABLE "InventoryTransaction" ADD COLUMN "submissionKey" TEXT;
CREATE UNIQUE INDEX "InventoryTransaction_submissionKey_key"
  ON "InventoryTransaction"("submissionKey");

ALTER TABLE "DailyProductionEntry" ADD COLUMN "submissionKey" TEXT;
CREATE UNIQUE INDEX "DailyProductionEntry_submissionKey_key"
  ON "DailyProductionEntry"("submissionKey");

ALTER TABLE "PurchaseReceiptEntry" ADD COLUMN "submissionKey" TEXT;
CREATE UNIQUE INDEX "PurchaseReceiptEntry_submissionKey_key"
  ON "PurchaseReceiptEntry"("submissionKey");
