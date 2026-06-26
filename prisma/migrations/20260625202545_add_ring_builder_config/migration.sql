-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "ringBuilderConfig" JSONB NOT NULL DEFAULT '[]';
