-- Drain ring sanitary style variant (STANDARD | SANITARY).

CREATE TYPE "DrainRingStyle" AS ENUM ('STANDARD', 'SANITARY');

ALTER TABLE "Product"
  ADD COLUMN "drainRingStyle" "DrainRingStyle" NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "QuoteLineItem"
  ADD COLUMN "drainRingStyle" "DrainRingStyle" NOT NULL DEFAULT 'STANDARD';

DROP INDEX IF EXISTS "Product_isDrainRing_ringDiameterFeet_idx";

CREATE INDEX "Product_isDrainRing_ringDiameterFeet_drainRingStyle_idx"
  ON "Product"("isDrainRing", "ringDiameterFeet", "drainRingStyle");
