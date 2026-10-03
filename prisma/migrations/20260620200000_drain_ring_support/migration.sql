-- Drain ring support.
-- Product gains ring SKU attributes; QuoteLineItem gains pool-in-feet attributes.

ALTER TABLE "Product"
  ADD COLUMN "isDrainRing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "heightFeet" DECIMAL(6,2),
  ADD COLUMN "ringDiameterFeet" DECIMAL(6,2);

ALTER TABLE "QuoteLineItem"
  ADD COLUMN "isDrainRing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ringDiameterFeet" DECIMAL(6,2),
  ADD COLUMN "poolHeightFeet" DECIMAL(6,2);

CREATE INDEX "Product_isDrainRing_ringDiameterFeet_idx" ON "Product"("isDrainRing", "ringDiameterFeet");
