-- AlterTable
ALTER TABLE "StructureTemplate" ADD COLUMN     "rectBaseSlabPrice" DECIMAL(12,2),
ADD COLUMN     "rectPdfSetId" TEXT,
ADD COLUMN     "rectTopSlabPrice" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "RectSheetPdfSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RectSheetPdfSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RectSheetPdfSetFile" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "hasTopSlab" BOOLEAN NOT NULL,
    "hasBaseSlab" BOOLEAN NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RectSheetPdfSetFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RectSheetPdfSet_name_key" ON "RectSheetPdfSet"("name");

-- CreateIndex
CREATE INDEX "RectSheetPdfSetFile_setId_idx" ON "RectSheetPdfSetFile"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "RectSheetPdfSetFile_setId_hasTopSlab_hasBaseSlab_key" ON "RectSheetPdfSetFile"("setId", "hasTopSlab", "hasBaseSlab");

-- CreateIndex
CREATE INDEX "StructureTemplate_rectPdfSetId_idx" ON "StructureTemplate"("rectPdfSetId");

-- AddForeignKey
ALTER TABLE "StructureTemplate" ADD CONSTRAINT "StructureTemplate_rectPdfSetId_fkey" FOREIGN KEY ("rectPdfSetId") REFERENCES "RectSheetPdfSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RectSheetPdfSetFile" ADD CONSTRAINT "RectSheetPdfSetFile_setId_fkey" FOREIGN KEY ("setId") REFERENCES "RectSheetPdfSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
