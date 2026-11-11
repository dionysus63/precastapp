-- CreateEnum
CREATE TYPE "MoldDiameterBasis" AS ENUM ('INSIDE', 'OUTSIDE');

-- AlterTable
ALTER TABLE "StructureDiameterConfig" ADD COLUMN     "hasKey" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sheetDiameterBasis" "MoldDiameterBasis" NOT NULL DEFAULT 'INSIDE';
