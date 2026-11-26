-- Whether a purchase is taxable. Printed on the purchase order PDF; existing
-- purchase orders read as non-taxable.
ALTER TABLE "PurchaseOrder" ADD COLUMN "taxable" BOOLEAN NOT NULL DEFAULT false;
