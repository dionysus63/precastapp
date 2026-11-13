-- Invoices right away: an invoice is made the moment its ticket is marked
-- delivered, and there is no draft stage any more.

-- 1. A line the app could not price bills $0 and prints PRICE NEEDED until
--    someone types a price on the invoice.
ALTER TABLE "InvoiceLineItem" ADD COLUMN "needsPrice" BOOLEAN NOT NULL DEFAULT false;

-- 2. Existing drafts: a $0 line whose price came from the quote or the price
--    list (not typed on the ticket, and not an "(included)" / "(partial set)"
--    piece that is billed on another line) is what the old "$0 line warning"
--    pointed at. Carry it over as PRICE NEEDED so it is not lost when the
--    draft becomes a normal invoice just below. The same goes for a $0
--    casting set charge, which has no ticket line of its own. A line someone
--    added by hand in the invoice editor is left alone.
UPDATE "InvoiceLineItem" AS li
SET "needsPrice" = true
FROM "Invoice" AS i
WHERE li."invoiceId" = i."id"
  AND i."status" = 'DRAFT'
  AND li."unitPrice" = 0
  AND COALESCE(li."description", '') NOT LIKE '%(included)'
  AND COALESCE(li."description", '') NOT LIKE '%(partial set)'
  AND (
    EXISTS (
      SELECT 1
      FROM "DeliveryTicketLineItem" AS tl
      WHERE tl."id" = li."deliveryTicketLineItemId"
        AND tl."unitPrice" IS NULL
    )
    OR (
      li."deliveryTicketLineItemId" IS NULL
      AND li."quoteLineItemId" IS NOT NULL
      AND li."description" LIKE '% shipped in pieces)'
    )
  );

-- 3. Existing drafts become normal (open) invoices. Their numbers, lines and
--    totals are untouched.
UPDATE "Invoice"
SET "status" = 'SENT',
    "invoiceDate" = COALESCE("invoiceDate", "createdAt")
WHERE "status" = 'DRAFT';

-- 4. New invoices start open. The DRAFT enum value stays (unused) so this
--    migration never has to rebuild the enum.
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'SENT';
