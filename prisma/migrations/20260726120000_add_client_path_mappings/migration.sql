-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "jobsRootClientPath" TEXT,
ADD COLUMN     "quotePdfFallbackDirClientPath" TEXT,
ADD COLUMN     "stockSubmittalsRootClientPath" TEXT;
