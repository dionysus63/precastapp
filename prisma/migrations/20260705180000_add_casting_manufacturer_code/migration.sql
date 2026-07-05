-- AlterTable
ALTER TABLE "Product" ADD COLUMN "manufacturerCode" TEXT;

-- CreateIndex
CREATE INDEX "Product_manufacturerCode_idx" ON "Product"("manufacturerCode");
