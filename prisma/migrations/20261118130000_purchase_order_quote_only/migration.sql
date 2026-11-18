-- A purchase order placed against the vendor's quote instead of typed lines:
-- it carries the quote's number and date, and its total is typed in.
ALTER TABLE "PurchaseOrder"
  ADD COLUMN "quoteOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "quoteNumber" TEXT,
  ADD COLUMN "quoteDate" DATE;
