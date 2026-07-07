-- CreateEnum
CREATE TYPE "ShippingZoneKind" AS ENUM ('RADIUS', 'POLYGON');

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "yardLatitude" DECIMAL(9,6),
ADD COLUMN     "yardLongitude" DECIMAL(9,6);

-- CreateTable
CREATE TABLE "ShippingZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ShippingZoneKind" NOT NULL,
    "radiusMiles" DECIMAL(8,2),
    "polygon" JSONB,
    "ratePerLoad" DECIMAL(12,2) NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShippingZone_active_idx" ON "ShippingZone"("active");

