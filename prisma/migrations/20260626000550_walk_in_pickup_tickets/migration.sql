-- CreateEnum
CREATE TYPE "FulfillmentMethod" AS ENUM ('DELIVERY', 'PICKUP');

-- CreateEnum
CREATE TYPE "TicketPaymentMethod" AS ENUM ('PAY_NOW', 'ON_ACCOUNT');

-- AlterTable
ALTER TABLE "DeliveryTicket" ADD COLUMN     "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'DELIVERY',
ADD COLUMN     "paymentMethod" "TicketPaymentMethod",
ADD COLUMN     "paymentReceived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pickedUpBy" TEXT;

-- CreateIndex
CREATE INDEX "DeliveryTicket_fulfillmentMethod_idx" ON "DeliveryTicket"("fulfillmentMethod");
