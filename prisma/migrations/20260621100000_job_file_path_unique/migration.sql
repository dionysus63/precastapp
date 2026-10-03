-- CreateIndex
CREATE UNIQUE INDEX "JobFile_jobId_filePath_key" ON "JobFile"("jobId", "filePath");
