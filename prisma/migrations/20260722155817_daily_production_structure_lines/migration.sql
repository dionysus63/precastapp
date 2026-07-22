-- AlterTable
ALTER TABLE "JobStructurePiece" ADD COLUMN     "madeDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DailyProductionStructureLine" (
    "id" TEXT NOT NULL,
    "productionEntryId" TEXT NOT NULL,
    "jobStructureId" TEXT NOT NULL,
    "jobStructurePieceId" TEXT,
    "quantityMade" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyProductionStructureLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyProductionStructureLine_productionEntryId_idx" ON "DailyProductionStructureLine"("productionEntryId");

-- CreateIndex
CREATE INDEX "DailyProductionStructureLine_jobStructureId_idx" ON "DailyProductionStructureLine"("jobStructureId");

-- AddForeignKey
ALTER TABLE "DailyProductionStructureLine" ADD CONSTRAINT "DailyProductionStructureLine_productionEntryId_fkey" FOREIGN KEY ("productionEntryId") REFERENCES "DailyProductionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyProductionStructureLine" ADD CONSTRAINT "DailyProductionStructureLine_jobStructureId_fkey" FOREIGN KEY ("jobStructureId") REFERENCES "JobStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyProductionStructureLine" ADD CONSTRAINT "DailyProductionStructureLine_jobStructurePieceId_fkey" FOREIGN KEY ("jobStructurePieceId") REFERENCES "JobStructurePiece"("id") ON DELETE SET NULL ON UPDATE CASCADE;
