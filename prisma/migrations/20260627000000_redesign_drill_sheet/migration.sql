-- CreateEnum
CREATE TYPE "PipeConnectionType" AS ENUM ('KOR_N_SEAL', 'CAST_IN', 'GROUTED', 'OTHER');

-- CreateEnum
CREATE TYPE "SumpMode" AS ENUM ('DEFAULT', 'FIXED');

-- DropForeignKey
ALTER TABLE "JobStructureManholeDetail" DROP CONSTRAINT "JobStructureManholeDetail_jobStructureId_fkey";

-- DropForeignKey
ALTER TABLE "StructureTemplateBootSize" DROP CONSTRAINT "StructureTemplateBootSize_templateId_fkey";

-- DropForeignKey
ALTER TABLE "StructureTemplateSection" DROP CONSTRAINT "StructureTemplateSection_diameterId_fkey";

-- AlterTable
ALTER TABLE "JobStructureOpening" DROP COLUMN "bootType",
DROP COLUMN "clockPosition",
DROP COLUMN "gasketType",
DROP COLUMN "holeDiameter",
DROP COLUMN "pipeDiameter",
DROP COLUMN "sleeveType",
DROP COLUMN "wallLocation",
ADD COLUMN     "baseTopToOpeningBottomInches" INTEGER,
ADD COLUMN     "bootModel" TEXT,
ADD COLUMN     "bottomOfOpeningFeet" DECIMAL(12,4),
ADD COLUMN     "holeDiameterInches" DECIMAL(6,2),
ADD COLUMN     "label" TEXT,
ADD COLUMN     "pipeMaterial" TEXT,
ADD COLUMN     "pipeSizeInches" DECIMAL(6,2),
ADD COLUMN     "pricePerBoot" DECIMAL(12,2),
ADD COLUMN     "topOfOpeningFeet" DECIMAL(12,4),
ADD COLUMN     "topOfPipeFeet" DECIMAL(12,4),
DROP COLUMN "connectionType",
ADD COLUMN     "connectionType" "PipeConnectionType";

-- AlterTable
ALTER TABLE "StructureTemplate" DROP COLUMN "keyClearanceFeet",
DROP COLUMN "minimumBrickFeet",
ADD COLUMN     "baseSlabThicknessInches" DECIMAL(6,2) NOT NULL DEFAULT 8,
ADD COLUMN     "castingProductId" TEXT,
ADD COLUMN     "connectionType" "PipeConnectionType" NOT NULL DEFAULT 'KOR_N_SEAL',
ADD COLUMN     "minimumBrickInches" DECIMAL(6,2) NOT NULL DEFAULT 4,
ADD COLUMN     "openingToJointMinBottomInches" DECIMAL(6,2) NOT NULL DEFAULT 4,
ADD COLUMN     "openingToJointMinTopInches" DECIMAL(6,2) NOT NULL DEFAULT 4,
ADD COLUMN     "sumpFixedInches" DECIMAL(6,2),
ADD COLUMN     "sumpMode" "SumpMode" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN     "topSlabThicknessInches" DECIMAL(6,2) NOT NULL DEFAULT 16,
ADD COLUMN     "wallThicknessInches" DECIMAL(6,2) NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "StructureTemplateDiameter" DROP COLUMN "moldMaxHeightFeet",
DROP COLUMN "topSlabHeightNoKeyFeet",
DROP COLUMN "topSlabHeightWithKeyFeet";

-- DropTable
DROP TABLE "JobStructureManholeDetail";

-- DropTable
DROP TABLE "StructureTemplateBootSize";

-- DropTable
DROP TABLE "StructureTemplateSection";

-- CreateTable
CREATE TABLE "PipeOpeningSize" (
    "id" TEXT NOT NULL,
    "pipeMaterial" TEXT NOT NULL,
    "pipeSizeInches" DECIMAL(6,2) NOT NULL,
    "pipeType" TEXT NOT NULL,
    "holeDiameterInches" DECIMAL(6,2) NOT NULL,
    "bootModel" TEXT,
    "pricePerBoot" DECIMAL(12,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipeOpeningSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureDiameterConfig" (
    "id" TEXT NOT NULL,
    "insideDiameterFeet" DECIMAL(6,2) NOT NULL,
    "maxBaseHeightFeet" DECIMAL(6,2) NOT NULL,
    "maxRiserHeightFeet" DECIMAL(6,2) NOT NULL,
    "keyHeightFeet" DECIMAL(6,4) NOT NULL,
    "wallPricePerFoot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "basePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StructureDiameterConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStructureCalc" (
    "id" TEXT NOT NULL,
    "jobStructureId" TEXT NOT NULL,
    "contractorName" TEXT,
    "projectName" TEXT,
    "sheetDate" TIMESTAMP(3),
    "hasSteps" BOOLEAN NOT NULL DEFAULT false,
    "rimElevation" DECIMAL(12,4),
    "lowestInvertFeet" DECIMAL(12,4),
    "sumpFeet" DECIMAL(12,4),
    "castingHeightFeet" DECIMAL(12,4),
    "topSlabThicknessFeet" DECIMAL(12,4),
    "wallHeightFeet" DECIMAL(12,4),
    "brickFeet" DECIMAL(12,4),
    "hasKey" BOOLEAN NOT NULL DEFAULT true,
    "totalHeightFeet" DECIMAL(12,4),
    "insideDiameterFeet" DECIMAL(12,4),
    "wallPrice" DECIMAL(12,2),
    "bootsPrice" DECIMAL(12,2),
    "totalPrice" DECIMAL(12,2),
    "errorMessage" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobStructureCalc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipeOpeningSize_pipeMaterial_idx" ON "PipeOpeningSize"("pipeMaterial");

-- CreateIndex
CREATE INDEX "PipeOpeningSize_pipeSizeInches_idx" ON "PipeOpeningSize"("pipeSizeInches");

-- CreateIndex
CREATE UNIQUE INDEX "PipeOpeningSize_pipeMaterial_pipeSizeInches_pipeType_key" ON "PipeOpeningSize"("pipeMaterial", "pipeSizeInches", "pipeType");

-- CreateIndex
CREATE UNIQUE INDEX "StructureDiameterConfig_insideDiameterFeet_key" ON "StructureDiameterConfig"("insideDiameterFeet");

-- CreateIndex
CREATE UNIQUE INDEX "JobStructureCalc_jobStructureId_key" ON "JobStructureCalc"("jobStructureId");

-- CreateIndex
CREATE INDEX "StructureTemplate_castingProductId_idx" ON "StructureTemplate"("castingProductId");

-- AddForeignKey
ALTER TABLE "StructureTemplate" ADD CONSTRAINT "StructureTemplate_castingProductId_fkey" FOREIGN KEY ("castingProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStructureCalc" ADD CONSTRAINT "JobStructureCalc_jobStructureId_fkey" FOREIGN KEY ("jobStructureId") REFERENCES "JobStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
