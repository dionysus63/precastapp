-- CreateEnum
CREATE TYPE "StructureShape" AS ENUM ('CIRCULAR', 'RECTANGULAR');

-- CreateEnum
CREATE TYPE "SectionRole" AS ENUM ('BASE', 'RISER');

-- CreateEnum
CREATE TYPE "StructureTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "JobStructure" ADD COLUMN     "structureTemplateId" TEXT;

-- AlterTable
ALTER TABLE "JobStructureManholeDetail" ADD COLUMN     "brickAdjustmentFeet" DECIMAL(12,4),
ADD COLUMN     "castingHeightFeet" DECIMAL(12,4),
ADD COLUMN     "contractorName" TEXT,
ADD COLUMN     "hasKey" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hasSteps" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invertToTopFeet" DECIMAL(12,4),
ADD COLUMN     "projectName" TEXT,
ADD COLUMN     "sheetDate" TIMESTAMP(3),
ADD COLUMN     "sumpFeet" DECIMAL(12,4),
ADD COLUMN     "topSlabHeightFeet" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "castingClearOpeningInches" DECIMAL(6,2),
ADD COLUMN     "isCasting" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StructureTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agencyStandard" TEXT,
    "shape" "StructureShape" NOT NULL DEFAULT 'CIRCULAR',
    "minimumBrickFeet" DECIMAL(6,4) NOT NULL DEFAULT 0.3333,
    "keyClearanceFeet" DECIMAL(6,4) NOT NULL DEFAULT 0.3333,
    "status" "StructureTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructureTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureTemplateDiameter" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "insideDiameterFeet" DECIMAL(6,2) NOT NULL,
    "moldMaxHeightFeet" DECIMAL(6,2) NOT NULL,
    "topSlabHeightWithKeyFeet" DECIMAL(6,4),
    "topSlabHeightNoKeyFeet" DECIMAL(6,4),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructureTemplateDiameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureTemplateSection" (
    "id" TEXT NOT NULL,
    "diameterId" TEXT NOT NULL,
    "role" "SectionRole" NOT NULL,
    "heightFeet" DECIMAL(6,4) NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructureTemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureTemplateBootSize" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "pipeDiameterInches" DECIMAL(6,2) NOT NULL,
    "holeDiameterInches" DECIMAL(6,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructureTemplateBootSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStructureSection" (
    "id" TEXT NOT NULL,
    "jobStructureId" TEXT NOT NULL,
    "role" "SectionRole" NOT NULL,
    "heightFeet" DECIMAL(6,4) NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobStructureSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StructureTemplate_name_key" ON "StructureTemplate"("name");

-- CreateIndex
CREATE INDEX "StructureTemplate_shape_idx" ON "StructureTemplate"("shape");

-- CreateIndex
CREATE INDEX "StructureTemplate_status_idx" ON "StructureTemplate"("status");

-- CreateIndex
CREATE INDEX "StructureTemplateDiameter_templateId_idx" ON "StructureTemplateDiameter"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "StructureTemplateDiameter_templateId_insideDiameterFeet_key" ON "StructureTemplateDiameter"("templateId", "insideDiameterFeet");

-- CreateIndex
CREATE INDEX "StructureTemplateSection_diameterId_idx" ON "StructureTemplateSection"("diameterId");

-- CreateIndex
CREATE INDEX "StructureTemplateBootSize_templateId_idx" ON "StructureTemplateBootSize"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "StructureTemplateBootSize_templateId_pipeDiameterInches_key" ON "StructureTemplateBootSize"("templateId", "pipeDiameterInches");

-- CreateIndex
CREATE INDEX "JobStructureSection_jobStructureId_idx" ON "JobStructureSection"("jobStructureId");

-- CreateIndex
CREATE INDEX "JobStructure_structureTemplateId_idx" ON "JobStructure"("structureTemplateId");

-- CreateIndex
CREATE INDEX "Product_isCasting_idx" ON "Product"("isCasting");

-- AddForeignKey
ALTER TABLE "StructureTemplateDiameter" ADD CONSTRAINT "StructureTemplateDiameter_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StructureTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureTemplateSection" ADD CONSTRAINT "StructureTemplateSection_diameterId_fkey" FOREIGN KEY ("diameterId") REFERENCES "StructureTemplateDiameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureTemplateBootSize" ADD CONSTRAINT "StructureTemplateBootSize_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StructureTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStructure" ADD CONSTRAINT "JobStructure_structureTemplateId_fkey" FOREIGN KEY ("structureTemplateId") REFERENCES "StructureTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStructureSection" ADD CONSTRAINT "JobStructureSection_jobStructureId_fkey" FOREIGN KEY ("jobStructureId") REFERENCES "JobStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
