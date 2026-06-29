-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "masterQuoteId" TEXT,
ADD COLUMN     "scopeLabel" TEXT;

-- CreateIndex
CREATE INDEX "Quote_masterQuoteId_idx" ON "Quote"("masterQuoteId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_masterQuoteId_fkey" FOREIGN KEY ("masterQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
