-- CreateTable
CREATE TABLE "SavedLoadPlan" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "planJson" TEXT NOT NULL,
    "savedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedLoadPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedLoadPlan_quoteId_key" ON "SavedLoadPlan"("quoteId");

-- CreateIndex
CREATE INDEX "SavedLoadPlan_jobId_idx" ON "SavedLoadPlan"("jobId");

-- AddForeignKey
ALTER TABLE "SavedLoadPlan" ADD CONSTRAINT "SavedLoadPlan_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
