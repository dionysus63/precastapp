-- AlterTable
ALTER TABLE "DeliveryTicketLineItem" ADD COLUMN     "jobStructurePieceId" TEXT;

-- CreateTable
CREATE TABLE "JobStructurePiece" (
    "id" TEXT NOT NULL,
    "jobStructureId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "weightLbs" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobStructurePiece_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobStructurePiece_jobStructureId_idx" ON "JobStructurePiece"("jobStructureId");

-- CreateIndex
CREATE INDEX "DeliveryTicketLineItem_jobStructurePieceId_idx" ON "DeliveryTicketLineItem"("jobStructurePieceId");

-- AddForeignKey
ALTER TABLE "JobStructurePiece" ADD CONSTRAINT "JobStructurePiece_jobStructureId_fkey" FOREIGN KEY ("jobStructureId") REFERENCES "JobStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTicketLineItem" ADD CONSTRAINT "DeliveryTicketLineItem_jobStructurePieceId_fkey" FOREIGN KEY ("jobStructurePieceId") REFERENCES "JobStructurePiece"("id") ON DELETE SET NULL ON UPDATE CASCADE;
