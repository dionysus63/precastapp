-- CreateEnum
CREATE TYPE "RectWall" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "RectOpeningPlacement" AS ENUM ('CENTERED', 'FROM_LEFT', 'FROM_RIGHT', 'TOUCH_LEFT', 'TOUCH_RIGHT');

-- DropIndex
DROP INDEX "StructureTemplatePdf_templateId_hasRiser_hasKey_key";

-- AlterTable
ALTER TABLE "JobStructureCalc" ADD COLUMN     "insideLengthFeet" DECIMAL(12,4),
ADD COLUMN     "insideWidthFeet" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "JobStructureDimension" ADD COLUMN     "baseAttached" BOOLEAN,
ADD COLUMN     "hasBaseSlab" BOOLEAN,
ADD COLUMN     "hasTopSlab" BOOLEAN,
ADD COLUMN     "topSlabOpeningLengthInches" DECIMAL(6,2),
ADD COLUMN     "topSlabOpeningSide" "RectWall",
ADD COLUMN     "topSlabOpeningWidthInches" DECIMAL(6,2);

-- AlterTable
ALTER TABLE "JobStructureOpening" ADD COLUMN     "horizontalPlacement" "RectOpeningPlacement",
ADD COLUMN     "offsetInches" DECIMAL(8,2),
ADD COLUMN     "openingHeightInches" DECIMAL(6,2),
ADD COLUMN     "openingWidthInches" DECIMAL(6,2),
ADD COLUMN     "wall" "RectWall";

-- AlterTable
ALTER TABLE "JobStructureSection" ADD COLUMN     "pickWeightLbs" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "StructureTemplate" ADD COLUMN     "rectMinPricingHeightFeet" DECIMAL(6,2),
ADD COLUMN     "rectWallPricePerFoot" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "StructureTemplatePdf" ADD COLUMN     "hasBaseSlab" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasTopSlab" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StructureTemplateRectSize" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "insideLengthFeet" DECIMAL(6,2) NOT NULL,
    "insideWidthFeet" DECIMAL(6,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructureTemplateRectSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RectOpeningSize" (
    "id" TEXT NOT NULL,
    "pipeMaterial" TEXT NOT NULL,
    "pipeSizeInches" DECIMAL(6,2) NOT NULL,
    "openingWidthInches" DECIMAL(6,2) NOT NULL,
    "openingHeightInches" DECIMAL(6,2) NOT NULL,
    "pricePerOpening" DECIMAL(12,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RectOpeningSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StructureTemplateRectSize_templateId_idx" ON "StructureTemplateRectSize"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "StructureTemplateRectSize_templateId_insideLengthFeet_insid_key" ON "StructureTemplateRectSize"("templateId", "insideLengthFeet", "insideWidthFeet");

-- CreateIndex
CREATE INDEX "RectOpeningSize_pipeMaterial_idx" ON "RectOpeningSize"("pipeMaterial");

-- CreateIndex
CREATE UNIQUE INDEX "RectOpeningSize_pipeMaterial_pipeSizeInches_key" ON "RectOpeningSize"("pipeMaterial", "pipeSizeInches");

-- CreateIndex
CREATE UNIQUE INDEX "StructureTemplatePdf_templateId_hasRiser_hasKey_hasTopSlab__key" ON "StructureTemplatePdf"("templateId", "hasRiser", "hasKey", "hasTopSlab", "hasBaseSlab");

-- AddForeignKey
ALTER TABLE "StructureTemplateRectSize" ADD CONSTRAINT "StructureTemplateRectSize_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StructureTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
