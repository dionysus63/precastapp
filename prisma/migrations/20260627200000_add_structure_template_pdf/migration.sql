-- CreateTable
CREATE TABLE "StructureTemplatePdf" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "hasRiser" BOOLEAN NOT NULL,
    "hasKey" BOOLEAN NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructureTemplatePdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StructureTemplatePdf_templateId_idx" ON "StructureTemplatePdf"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "StructureTemplatePdf_templateId_hasRiser_hasKey_key" ON "StructureTemplatePdf"("templateId", "hasRiser", "hasKey");

-- AddForeignKey
ALTER TABLE "StructureTemplatePdf" ADD CONSTRAINT "StructureTemplatePdf_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StructureTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
