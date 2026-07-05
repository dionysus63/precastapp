-- CreateEnum
CREATE TYPE "CastingSellAreaStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "castingSoldAsUnit" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CastingSellArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CastingSellAreaStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CastingSellArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCastingSellArea" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sellAreaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCastingSellArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CastingSellArea_name_key" ON "CastingSellArea"("name");

-- CreateIndex
CREATE INDEX "CastingSellArea_status_idx" ON "CastingSellArea"("status");

-- CreateIndex
CREATE INDEX "CastingSellArea_sortOrder_idx" ON "CastingSellArea"("sortOrder");

-- CreateIndex
CREATE INDEX "ProductCastingSellArea_productId_idx" ON "ProductCastingSellArea"("productId");

-- CreateIndex
CREATE INDEX "ProductCastingSellArea_sellAreaId_idx" ON "ProductCastingSellArea"("sellAreaId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCastingSellArea_productId_sellAreaId_key" ON "ProductCastingSellArea"("productId", "sellAreaId");

-- CreateIndex
CREATE INDEX "Product_castingSoldAsUnit_idx" ON "Product"("castingSoldAsUnit");

-- AddForeignKey
ALTER TABLE "ProductCastingSellArea" ADD CONSTRAINT "ProductCastingSellArea_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCastingSellArea" ADD CONSTRAINT "ProductCastingSellArea_sellAreaId_fkey" FOREIGN KEY ("sellAreaId") REFERENCES "CastingSellArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
