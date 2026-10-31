-- CreateTable
CREATE TABLE "OneOffDraft" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobId" TEXT,
    "draftJson" TEXT NOT NULL,
    "savedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneOffDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OneOffDraft_jobId_idx" ON "OneOffDraft"("jobId");

-- CreateIndex
CREATE INDEX "OneOffDraft_updatedAt_idx" ON "OneOffDraft"("updatedAt");

-- AddForeignKey
ALTER TABLE "OneOffDraft" ADD CONSTRAINT "OneOffDraft_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
