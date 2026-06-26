-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('STANDARD', 'DRAIN_RING', 'CASTING_ASSEMBLY', 'CASTING_COMPONENT', 'PIPE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "pipeClass" TEXT,
ADD COLUMN     "pipeDiameterInches" DECIMAL(6,2),
ADD COLUMN     "pipeJointType" TEXT,
ADD COLUMN     "pipeLengthFeet" DECIMAL(6,2),
ADD COLUMN     "productKind" "ProductKind" NOT NULL DEFAULT 'STANDARD';

-- CreateIndex
CREATE INDEX "Product_productKind_idx" ON "Product"("productKind");

-- CreateIndex
CREATE INDEX "Product_productKind_pipeDiameterInches_idx" ON "Product"("productKind", "pipeDiameterInches");
