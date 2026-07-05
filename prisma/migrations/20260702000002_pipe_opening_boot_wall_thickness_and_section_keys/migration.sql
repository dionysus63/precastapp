-- DropIndex
DROP INDEX "PipeOpeningSize_pipeMaterial_pipeSizeInches_pipeType_key";

-- AlterTable
ALTER TABLE "JobStructureSection" ADD COLUMN     "hasBottomKey" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hasTopKey" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "PipeOpeningSize" ADD COLUMN     "hasBoot" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pipeWallThicknessInches" DECIMAL(6,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "PipeOpeningSize_pipeMaterial_pipeSizeInches_pipeType_hasBoo_key" ON "PipeOpeningSize"("pipeMaterial", "pipeSizeInches", "pipeType", "hasBoot");
