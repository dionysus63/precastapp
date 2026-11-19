-- "Keep zoom" beside a PDF preview's zoom buttons: the zoom each user chose
-- to keep for the previews of one screen (first the Invoices list). No row
-- means that screen opens fitted, as before.
-- CreateTable
CREATE TABLE "UserPreviewZoom" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "screen" TEXT NOT NULL,
    "zoomPercent" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreviewZoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreviewZoom_userId_screen_key" ON "UserPreviewZoom"("userId", "screen");

-- AddForeignKey
ALTER TABLE "UserPreviewZoom" ADD CONSTRAINT "UserPreviewZoom_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

