-- Who at the vendor the purchase order is addressed to ("Attn:" in the Vendor
-- block of the PDF). Orders already on file take their vendor's contact, which
-- is what printed for them until now.
ALTER TABLE "PurchaseOrder" ADD COLUMN "attention" TEXT;

UPDATE "PurchaseOrder" AS po
SET "attention" = NULLIF(BTRIM(v."contactName"), '')
FROM "Vendor" AS v
WHERE v."id" = po."vendorId";
