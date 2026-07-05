-- CreateEnum
CREATE TYPE "PlanSheetSourceType" AS ENUM ('UPLOAD', 'JOB_FILE');

-- CreateTable
CREATE TABLE "PlanSheet" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT,
    "jobId" TEXT,
    "sourceType" "PlanSheetSourceType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL DEFAULT 1,
    "markupJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanSheet_quoteId_idx" ON "PlanSheet"("quoteId");

-- CreateIndex
CREATE INDEX "PlanSheet_jobId_idx" ON "PlanSheet"("jobId");

-- AddForeignKey
ALTER TABLE "PlanSheet" ADD CONSTRAINT "PlanSheet_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSheet" ADD CONSTRAINT "PlanSheet_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
