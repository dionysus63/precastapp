-- AlterEnum
ALTER TYPE "QuoteStatus" ADD VALUE 'LOST_BC';

-- CreateTable
CREATE TABLE "JobBidder" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobBidder_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "jobBidderId" TEXT,
ADD COLUMN "sentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "JobBidder_jobId_idx" ON "JobBidder"("jobId");

-- CreateIndex
CREATE INDEX "JobBidder_customerId_idx" ON "JobBidder"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "JobBidder_jobId_customerId_key" ON "JobBidder"("jobId", "customerId");

-- CreateIndex
CREATE INDEX "Quote_jobBidderId_idx" ON "Quote"("jobBidderId");

-- AddForeignKey
ALTER TABLE "JobBidder" ADD CONSTRAINT "JobBidder_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobBidder" ADD CONSTRAINT "JobBidder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_jobBidderId_fkey" FOREIGN KEY ("jobBidderId") REFERENCES "JobBidder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
