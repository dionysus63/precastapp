-- CreateEnum
CREATE TYPE "DiscountGroup" AS ENUM ('STOCK_PRECAST', 'CASTING_IMPORTED', 'CASTING_DOMESTIC', 'ADS_PIPE', 'RCP_PIPE', 'OTHER');

-- CreateTable
CREATE TABLE "DiscountRule" (
    "group" "DiscountGroup" NOT NULL,
    "deliveredPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pickupPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("group")
);

-- The company's standing rules (2026-11-25): stock precast 10% delivered and
-- 20% picked up, imported cast iron 10% either way, everything else none.
INSERT INTO "DiscountRule" ("group", "deliveredPercent", "pickupPercent", "updatedAt") VALUES
    ('STOCK_PRECAST', 10, 20, CURRENT_TIMESTAMP),
    ('CASTING_IMPORTED', 10, 10, CURRENT_TIMESTAMP),
    ('CASTING_DOMESTIC', 0, 0, CURRENT_TIMESTAMP),
    ('ADS_PIPE', 0, 0, CURRENT_TIMESTAMP),
    ('RCP_PIPE', 0, 0, CURRENT_TIMESTAMP),
    ('OTHER', 0, 0, CURRENT_TIMESTAMP);
