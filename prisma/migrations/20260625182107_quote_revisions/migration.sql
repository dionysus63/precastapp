-- AlterTable
ALTER TABLE "QuoteLineItem" ADD COLUMN     "previousLineItemId" TEXT;

-- CreateIndex
CREATE INDEX "Quote_originalQuoteId_idx" ON "Quote"("originalQuoteId");

-- CreateIndex
CREATE INDEX "QuoteLineItem_previousLineItemId_idx" ON "QuoteLineItem"("previousLineItemId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_originalQuoteId_fkey" FOREIGN KEY ("originalQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_previousLineItemId_fkey" FOREIGN KEY ("previousLineItemId") REFERENCES "QuoteLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
