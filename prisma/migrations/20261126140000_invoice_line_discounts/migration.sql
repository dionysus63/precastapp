-- Invoice lines carry the list price and the discount beside the billed
-- price, so the invoice can print List Price, Disc % and Net Price like the
-- quote. Adds columns only; existing invoices keep their prices.
ALTER TABLE "InvoiceLineItem" ADD COLUMN "listPrice" DECIMAL(12,2);
ALTER TABLE "InvoiceLineItem" ADD COLUMN "discountPercent" DECIMAL(5,2);
