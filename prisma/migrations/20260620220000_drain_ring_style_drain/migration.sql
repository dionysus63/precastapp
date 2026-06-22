-- Rename DrainRingStyle value STANDARD to DRAIN.

ALTER TYPE "DrainRingStyle" RENAME VALUE 'STANDARD' TO 'DRAIN';

ALTER TABLE "Product"
  ALTER COLUMN "drainRingStyle" SET DEFAULT 'DRAIN';

ALTER TABLE "QuoteLineItem"
  ALTER COLUMN "drainRingStyle" SET DEFAULT 'DRAIN';
