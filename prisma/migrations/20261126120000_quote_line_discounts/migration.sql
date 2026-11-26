-- CreateEnum
CREATE TYPE "QuoteDiscountBasis" AS ENUM ('DELIVERED', 'PICKUP');

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "discountBasis" "QuoteDiscountBasis" NOT NULL DEFAULT 'DELIVERED',
ADD COLUMN     "showDiscount" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "QuoteLineItem" ADD COLUMN     "listPrice" DECIMAL(12,2),
ADD COLUMN     "discountPercent" DECIMAL(5,2),
ADD COLUMN     "discountTyped" BOOLEAN NOT NULL DEFAULT false;
