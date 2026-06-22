-- CreateTable
CREATE TABLE "JobFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobFavorite_userId_idx" ON "JobFavorite"("userId");

-- CreateIndex
CREATE INDEX "JobFavorite_jobId_idx" ON "JobFavorite"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobFavorite_userId_jobId_key" ON "JobFavorite"("userId", "jobId");

-- AddForeignKey
ALTER TABLE "JobFavorite" ADD CONSTRAINT "JobFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFavorite" ADD CONSTRAINT "JobFavorite_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
