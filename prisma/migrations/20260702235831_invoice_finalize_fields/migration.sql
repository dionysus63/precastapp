-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedBy" TEXT;
