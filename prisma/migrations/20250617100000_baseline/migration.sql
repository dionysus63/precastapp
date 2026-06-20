-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('COMMERCIAL', 'RESIDENTIAL', 'CONTRACTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PROSPECT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('LEAD', 'QUOTING', 'SUBMITTED', 'AWARDED', 'ACTIVE', 'ON_HOLD', 'COMPLETE', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'SENT', 'REVISED', 'WON', 'LOST', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteType" AS ENUM ('STOCK_ONLY', 'CONFIGURABLE_STRUCTURES', 'CUSTOM_STRUCTURES', 'MIXED');

-- CreateEnum
CREATE TYPE "QuoteLineType" AS ENUM ('STOCK_PRODUCT', 'CONFIGURABLE_STRUCTURE', 'CUSTOM_STRUCTURE', 'SERVICE', 'MISC');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('STOCK', 'CONFIGURABLE', 'CUSTOM_STRUCTURE', 'SERVICE', 'MATERIAL');

-- CreateEnum
CREATE TYPE "ProductDocumentType" AS ENUM ('GENERIC_SUBMITTAL', 'SHOP_DRAWING', 'CUT_SHEET_TEMPLATE', 'SPEC_SHEET', 'INSTALLATION_INSTRUCTIONS', 'OTHER');

-- CreateEnum
CREATE TYPE "StructureType" AS ENUM ('STOCK_PRODUCT', 'CONFIGURABLE_PRODUCT', 'CUSTOM_STRUCTURE');

-- CreateEnum
CREATE TYPE "StructureStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'APPROVED', 'IN_PRODUCTION', 'MADE', 'SHIPPED');

-- CreateEnum
CREATE TYPE "JobStructureDocumentType" AS ENUM ('CUT_SHEET', 'JOB_SPECIFIC_SUBMITTAL', 'APPROVED_SUBMITTAL', 'PRODUCTION_DRAWING', 'FIELD_SKETCH', 'OTHER');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL DEFAULT 'STOCK',
    "category" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'EA',
    "defaultPrice" DECIMAL(12,2),
    "cost" DECIMAL(12,2),
    "weight" DECIMAL(12,2),
    "yards" DECIMAL(12,4),
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "currentStockQuantity" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "yardLocation" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDocument" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "documentType" "ProductDocumentType" NOT NULL,
    "documentName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerType" "CustomerType" NOT NULL DEFAULT 'CONTRACTOR',
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "primaryContactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "billingAddress" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "yearTwoDigit" INTEGER NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "projectAddress" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'LEAD',
    "bidDate" TIMESTAMP(3),
    "awardedDate" TIMESTAMP(3),
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "folderPath" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSequence" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobFile" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "folderCategory" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStructure" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "quoteId" TEXT,
    "productId" TEXT,
    "structureType" "StructureType" NOT NULL,
    "structureNumber" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(12,4),
    "unit" TEXT,
    "weight" DECIMAL(12,2),
    "yards" DECIMAL(12,4),
    "status" "StructureStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "productionDate" TIMESTAMP(3),
    "submittedDate" TIMESTAMP(3),
    "approvedDate" TIMESTAMP(3),
    "madeDate" TIMESTAMP(3),
    "shippedDate" TIMESTAMP(3),
    "needsCutSheet" BOOLEAN NOT NULL DEFAULT false,
    "needsSubmittal" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStructureOpening" (
    "id" TEXT NOT NULL,
    "jobStructureId" TEXT NOT NULL,
    "openingNumber" INTEGER,
    "wallLocation" TEXT,
    "clockPosition" TEXT,
    "pipeType" TEXT,
    "pipeDiameter" DECIMAL(12,4),
    "connectionType" TEXT,
    "invertElevation" DECIMAL(12,4),
    "holeDiameter" DECIMAL(12,4),
    "bootType" TEXT,
    "gasketType" TEXT,
    "sleeveType" TEXT,
    "angle" DECIMAL(12,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobStructureOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStructureCasting" (
    "id" TEXT NOT NULL,
    "jobStructureId" TEXT NOT NULL,
    "castingProductId" TEXT,
    "castingType" TEXT,
    "castingDescription" TEXT,
    "frameSize" TEXT,
    "coverType" TEXT,
    "grateType" TEXT,
    "hatchSize" TEXT,
    "loadRating" TEXT,
    "boltDown" BOOLEAN,
    "vented" BOOLEAN,
    "quantity" DECIMAL(12,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobStructureCasting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStructureDimension" (
    "id" TEXT NOT NULL,
    "jobStructureId" TEXT NOT NULL,
    "insideLength" DECIMAL(12,4),
    "insideWidth" DECIMAL(12,4),
    "insideHeight" DECIMAL(12,4),
    "outsideLength" DECIMAL(12,4),
    "outsideWidth" DECIMAL(12,4),
    "outsideHeight" DECIMAL(12,4),
    "wallThickness" DECIMAL(12,4),
    "topSlabThickness" DECIMAL(12,4),
    "baseSlabThickness" DECIMAL(12,4),
    "haunch" DECIMAL(12,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobStructureDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStructureManholeDetail" (
    "id" TEXT NOT NULL,
    "jobStructureId" TEXT NOT NULL,
    "manholeStandard" TEXT,
    "rimElevation" DECIMAL(12,4),
    "lowestInvertElevation" DECIMAL(12,4),
    "requiredWallHeight" DECIMAL(12,4),
    "baseSlabThickness" DECIMAL(12,4),
    "topSlabThickness" DECIMAL(12,4),
    "insideDiameter" DECIMAL(12,4),
    "coneOrFlatTop" TEXT,
    "frameAndCoverType" TEXT,
    "chimneyHeight" DECIMAL(12,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobStructureManholeDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStructureDocument" (
    "id" TEXT NOT NULL,
    "jobStructureId" TEXT NOT NULL,
    "documentType" "JobStructureDocumentType" NOT NULL,
    "documentName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "JobStructureDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "originalQuoteId" TEXT,
    "jobId" TEXT,
    "customerId" TEXT,
    "jobNumber" TEXT,
    "customerName" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "projectAddress" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "quoteType" "QuoteType" NOT NULL DEFAULT 'MIXED',
    "estimator" TEXT,
    "quoteDate" TIMESTAMP(3),
    "bidDueDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "priceListId" TEXT,
    "customerPO" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "salesTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalWeight" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalYards" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "internalNotes" TEXT,
    "customerNotes" TEXT,
    "termsAndConditions" TEXT,
    "leadTime" TEXT,
    "deliveryNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLineItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "lineType" "QuoteLineType" NOT NULL,
    "productId" TEXT,
    "jobStructureId" TEXT,
    "itemCode" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'EA',
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "weight" DECIMAL(12,2),
    "yards" DECIMAL(12,4),
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "statusNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_productCode_key" ON "Product"("productCode");

-- CreateIndex
CREATE INDEX "ProductDocument_productId_idx" ON "ProductDocument"("productId");

-- CreateIndex
CREATE INDEX "Contact_customerId_idx" ON "Contact"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");

-- CreateIndex
CREATE INDEX "Job_customerId_idx" ON "Job"("customerId");

-- CreateIndex
CREATE INDEX "Job_year_idx" ON "Job"("year");

-- CreateIndex
CREATE INDEX "Job_yearTwoDigit_idx" ON "Job"("yearTwoDigit");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Job_year_sequenceNumber_key" ON "Job"("year", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "JobSequence_year_key" ON "JobSequence"("year");

-- CreateIndex
CREATE INDEX "JobFile_jobId_idx" ON "JobFile"("jobId");

-- CreateIndex
CREATE INDEX "JobStructure_jobId_idx" ON "JobStructure"("jobId");

-- CreateIndex
CREATE INDEX "JobStructure_quoteId_idx" ON "JobStructure"("quoteId");

-- CreateIndex
CREATE INDEX "JobStructure_productId_idx" ON "JobStructure"("productId");

-- CreateIndex
CREATE INDEX "JobStructure_status_idx" ON "JobStructure"("status");

-- CreateIndex
CREATE INDEX "JobStructureOpening_jobStructureId_idx" ON "JobStructureOpening"("jobStructureId");

-- CreateIndex
CREATE INDEX "JobStructureCasting_jobStructureId_idx" ON "JobStructureCasting"("jobStructureId");

-- CreateIndex
CREATE INDEX "JobStructureCasting_castingProductId_idx" ON "JobStructureCasting"("castingProductId");

-- CreateIndex
CREATE UNIQUE INDEX "JobStructureDimension_jobStructureId_key" ON "JobStructureDimension"("jobStructureId");

-- CreateIndex
CREATE UNIQUE INDEX "JobStructureManholeDetail_jobStructureId_key" ON "JobStructureManholeDetail"("jobStructureId");

-- CreateIndex
CREATE INDEX "JobStructureDocument_jobStructureId_idx" ON "JobStructureDocument"("jobStructureId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");

-- CreateIndex
CREATE INDEX "Quote_jobId_idx" ON "Quote"("jobId");

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");

-- CreateIndex
CREATE INDEX "Quote_priceListId_idx" ON "Quote"("priceListId");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Quote_quoteDate_idx" ON "Quote"("quoteDate");

-- CreateIndex
CREATE INDEX "QuoteLineItem_quoteId_idx" ON "QuoteLineItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteLineItem_productId_idx" ON "QuoteLineItem"("productId");

-- CreateIndex
CREATE INDEX "QuoteLineItem_jobStructureId_idx" ON "QuoteLineItem"("jobStructureId");

-- AddForeignKey
ALTER TABLE "ProductDocument" ADD CONSTRAINT "ProductDocument_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFile" ADD CONSTRAINT "JobFile_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStructure" ADD CONSTRAINT "JobStructure_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStructure" ADD CONSTRAINT "JobStructure_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStructure" ADD CONSTRAINT "JobStructure_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStructureOpening" ADD CONSTRAINT "JobStructureOpening_jobStructureId_fkey" FOREIGN KEY ("jobStructureId") REFERENCES "JobStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStructureCasting" ADD CONSTRAINT "JobStructureCasting_jobStructureId_fkey" FOREIGN KEY ("jobStructureId") REFERENCES "JobStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStructureCasting" ADD CONSTRAINT "JobStructureCasting_castingProductId_fkey" FOREIGN KEY ("castingProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStructureDimension" ADD CONSTRAINT "JobStructureDimension_jobStructureId_fkey" FOREIGN KEY ("jobStructureId") REFERENCES "JobStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStructureManholeDetail" ADD CONSTRAINT "JobStructureManholeDetail_jobStructureId_fkey" FOREIGN KEY ("jobStructureId") REFERENCES "JobStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStructureDocument" ADD CONSTRAINT "JobStructureDocument_jobStructureId_fkey" FOREIGN KEY ("jobStructureId") REFERENCES "JobStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_jobStructureId_fkey" FOREIGN KEY ("jobStructureId") REFERENCES "JobStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;