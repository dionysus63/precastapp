-- CreateEnum
CREATE TYPE "CastingSupplierOrigin" AS ENUM ('DOMESTIC', 'IMPORTED');

-- CreateEnum
CREATE TYPE "CastingSupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CastingRole" AS ENUM ('ASSEMBLY', 'COMPONENT');

-- CreateEnum
CREATE TYPE "CastingPieceRole" AS ENUM ('FRAME', 'COVER', 'GRATE');

-- AlterEnum
ALTER TYPE "InventoryReferenceType" ADD VALUE 'PURCHASE_RECEIPT_LINE';

-- AlterEnum
ALTER TYPE "InventoryTransactionType" ADD VALUE 'PURCHASE_RECEIPT';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "castingPieceRole" "CastingPieceRole",
ADD COLUMN     "castingRole" "CastingRole",
ADD COLUMN     "castingSupplierId" TEXT;

-- CreateTable
CREATE TABLE "CastingSupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "origin" "CastingSupplierOrigin" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CastingSupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CastingSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCastingComponent" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "pieceRole" "CastingPieceRole" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCastingComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceiptEntry" (
    "id" TEXT NOT NULL,
    "receiptDate" DATE NOT NULL,
    "supplierId" TEXT,
    "batchLabel" TEXT,
    "enteredBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseReceiptEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceiptLine" (
    "id" TEXT NOT NULL,
    "purchaseReceiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityReceived" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "PurchaseReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CastingSupplier_name_key" ON "CastingSupplier"("name");

-- CreateIndex
CREATE INDEX "CastingSupplier_status_idx" ON "CastingSupplier"("status");

-- CreateIndex
CREATE INDEX "CastingSupplier_sortOrder_idx" ON "CastingSupplier"("sortOrder");

-- CreateIndex
CREATE INDEX "ProductCastingComponent_assemblyId_idx" ON "ProductCastingComponent"("assemblyId");

-- CreateIndex
CREATE INDEX "ProductCastingComponent_componentId_idx" ON "ProductCastingComponent"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCastingComponent_assemblyId_pieceRole_key" ON "ProductCastingComponent"("assemblyId", "pieceRole");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCastingComponent_assemblyId_componentId_key" ON "ProductCastingComponent"("assemblyId", "componentId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptEntry_receiptDate_idx" ON "PurchaseReceiptEntry"("receiptDate");

-- CreateIndex
CREATE INDEX "PurchaseReceiptEntry_supplierId_idx" ON "PurchaseReceiptEntry"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptLine_purchaseReceiptId_idx" ON "PurchaseReceiptLine"("purchaseReceiptId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptLine_productId_idx" ON "PurchaseReceiptLine"("productId");

-- CreateIndex
CREATE INDEX "Product_castingRole_idx" ON "Product"("castingRole");

-- CreateIndex
CREATE INDEX "Product_castingSupplierId_idx" ON "Product"("castingSupplierId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_castingSupplierId_fkey" FOREIGN KEY ("castingSupplierId") REFERENCES "CastingSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCastingComponent" ADD CONSTRAINT "ProductCastingComponent_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCastingComponent" ADD CONSTRAINT "ProductCastingComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptEntry" ADD CONSTRAINT "PurchaseReceiptEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "CastingSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptLine" ADD CONSTRAINT "PurchaseReceiptLine_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceiptEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptLine" ADD CONSTRAINT "PurchaseReceiptLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
