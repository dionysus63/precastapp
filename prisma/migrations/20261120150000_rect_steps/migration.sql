-- CreateEnum
CREATE TYPE "RectStepsPosition" AS ENUM ('UP_LEFT', 'UP_MIDDLE', 'UP_RIGHT', 'RIGHT_TOP', 'RIGHT_MIDDLE', 'RIGHT_BOTTOM', 'DOWN_LEFT', 'DOWN_MIDDLE', 'DOWN_RIGHT', 'LEFT_TOP', 'LEFT_MIDDLE', 'LEFT_BOTTOM');

-- AlterTable
ALTER TABLE "StructureTemplate" ADD COLUMN     "rectStepsOffsetInches" DECIMAL(6,2);

-- AlterTable
ALTER TABLE "JobStructureDimension" ADD COLUMN     "stepsPosition" "RectStepsPosition";
