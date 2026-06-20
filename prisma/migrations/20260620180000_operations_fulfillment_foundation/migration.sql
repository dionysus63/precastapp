-- CreateEnum
CREATE TYPE "DeliveryTicketStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LOADING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryTicketType" AS ENUM ('JOB', 'WALK_IN');

-- CreateEnum
CREATE TYPE "DeliveryLineType" AS ENUM ('STOCK_PRODUCT', 'CONFIGURABLE_STRUCTURE', 'CUSTOM_STRUCTURE', 'SERVICE', 'MISC');

-- CreateEnum
CREATE TYPE "DeliveryItemStatus" AS ENUM ('NOT_READY', 'READY', 'LOADING', 'LOADED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('PRODUCTION', 'DELIVERY', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "InventoryReferenceType" AS ENUM ('DAILY_PRODUCTION_LINE', 'DELIVERY_TICKET_LINE_ITEM');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceLineType" AS ENUM ('STOCK_PRODUCT', 'CONFIGURABLE_STRUCTURE', 'CUSTOM_STRUCTURE', 'SERVICE', 'MISC');

-- CreateTable
CREATE TABLE "DeliveryTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "yearTwoDigit" INTEGER NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "ticketType" "DeliveryTicketType" NOT NULL DEFAULT 'JOB',
    "status" "DeliveryTicketStatus" NOT NULL DEFAULT 'DRAFT',
    "jobId" TEXT,
    "quoteId" TEXT,
    "customerId" TEXT,
    "priceListId" TEXT,
    "jobNumber" TEXT,
    "quoteNumber" TEXT,
    "customerName" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "deliveryAddress" TEXT,
    "siteContactName" TEXT,
    "siteContactPhone" TEXT,
    "siteContactEmail" TEXT,
    "siteInstructions" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "deliveryTime" TEXT,
    "requestedBy" TEXT,
    "createdBy" TEXT,
    "truck" TEXT,
    "trailer" TEXT,
    "driver" TEXT,
    "loadSequence" TEXT,
    "specialEquipmentNeeded" TEXT,
    "craneRequired" BOOLEAN NOT NULL DEFAULT false,
    "forkliftRequired" BOOLEAN NOT NULL DEFAULT false,
    "totalItems" INTEGER,
    "totalWeight" DECIMAL(12,2),
    "driverNotes" TEXT,
    "internalNotes" TEXT,
    "customerNotes" TEXT,
    "loadingNotes" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "signedBy" TEXT,
    "paperTicketPrinted" BOOLEAN NOT NULL DEFAULT false,
    "paperTicketVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTicketLineItem" (
    "id" TEXT NOT NULL,
    "deliveryTicketId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "lineType" "DeliveryLineType" NOT NULL,
    "productId" TEXT,
    "quoteLineItemId" TEXT,
    "jobStructureId" TEXT,
    "itemCode" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'EA',
    "weightEach" DECIMAL(12,2),
    "totalWeight" DECIMAL(12,2),
    "yardLocation" TEXT,
    "status" "DeliveryItemStatus" NOT NULL DEFAULT 'NOT_READY',
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryTicketLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTicketSequence" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryTicketSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityChange" DECIMAL(12,4) NOT NULL,
    "transactionType" "InventoryTransactionType" NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "referenceType" "InventoryReferenceType",
    "referenceId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyProductionEntry" (
    "id" TEXT NOT NULL,
    "productionDate" DATE NOT NULL,
    "batchLabel" TEXT,
    "enteredBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyProductionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyProductionLine" (
    "id" TEXT NOT NULL,
    "productionEntryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityProduced" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "DailyProductionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryDayReconciliation" (
    "id" TEXT NOT NULL,
    "reconciliationDate" DATE NOT NULL,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryDayReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "yearTwoDigit" INTEGER NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "deliveryTicketId" TEXT NOT NULL,
    "jobId" TEXT,
    "quoteId" TEXT,
    "customerId" TEXT,
    "jobNumber" TEXT,
    "customerName" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "salesTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "invoiceDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "lineType" "InvoiceLineType" NOT NULL,
    "quoteLineItemId" TEXT,
    "deliveryTicketLineItemId" TEXT,
    "productId" TEXT,
    "itemCode" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'EA',
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListItem" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTicket_ticketNumber_key" ON "DeliveryTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX "DeliveryTicket_jobId_idx" ON "DeliveryTicket"("jobId");

-- CreateIndex
CREATE INDEX "DeliveryTicket_quoteId_idx" ON "DeliveryTicket"("quoteId");

-- CreateIndex
CREATE INDEX "DeliveryTicket_customerId_idx" ON "DeliveryTicket"("customerId");

-- CreateIndex
CREATE INDEX "DeliveryTicket_priceListId_idx" ON "DeliveryTicket"("priceListId");

-- CreateIndex
CREATE INDEX "DeliveryTicket_status_idx" ON "DeliveryTicket"("status");

-- CreateIndex
CREATE INDEX "DeliveryTicket_deliveryDate_idx" ON "DeliveryTicket"("deliveryDate");

-- CreateIndex
CREATE INDEX "DeliveryTicket_yearTwoDigit_idx" ON "DeliveryTicket"("yearTwoDigit");

-- CreateIndex
CREATE INDEX "DeliveryTicket_ticketType_idx" ON "DeliveryTicket"("ticketType");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTicket_year_sequenceNumber_key" ON "DeliveryTicket"("year", "sequenceNumber");

-- CreateIndex
CREATE INDEX "DeliveryTicketLineItem_deliveryTicketId_idx" ON "DeliveryTicketLineItem"("deliveryTicketId");

-- CreateIndex
CREATE INDEX "DeliveryTicketLineItem_productId_idx" ON "DeliveryTicketLineItem"("productId");

-- CreateIndex
CREATE INDEX "DeliveryTicketLineItem_quoteLineItemId_idx" ON "DeliveryTicketLineItem"("quoteLineItemId");

-- CreateIndex
CREATE INDEX "DeliveryTicketLineItem_jobStructureId_idx" ON "DeliveryTicketLineItem"("jobStructureId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTicketSequence_year_key" ON "DeliveryTicketSequence"("year");

-- CreateIndex
CREATE INDEX "InventoryTransaction_productId_idx" ON "InventoryTransaction"("productId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_transactionDate_idx" ON "InventoryTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "InventoryTransaction_referenceType_referenceId_idx" ON "InventoryTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "DailyProductionEntry_productionDate_idx" ON "DailyProductionEntry"("productionDate");

-- CreateIndex
CREATE INDEX "DailyProductionLine_productionEntryId_idx" ON "DailyProductionLine"("productionEntryId");

-- CreateIndex
CREATE INDEX "DailyProductionLine_productId_idx" ON "DailyProductionLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDayReconciliation_reconciliationDate_key" ON "DeliveryDayReconciliation"("reconciliationDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_deliveryTicketId_key" ON "Invoice"("deliveryTicketId");

-- CreateIndex
CREATE INDEX "Invoice_jobId_idx" ON "Invoice"("jobId");

-- CreateIndex
CREATE INDEX "Invoice_quoteId_idx" ON "Invoice"("quoteId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_year_sequenceNumber_key" ON "Invoice"("year", "sequenceNumber");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_quoteLineItemId_idx" ON "InvoiceLineItem"("quoteLineItemId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_deliveryTicketLineItemId_idx" ON "InvoiceLineItem"("deliveryTicketLineItemId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_productId_idx" ON "InvoiceLineItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSequence_year_key" ON "InvoiceSequence"("year");

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_name_key" ON "PriceList"("name");

-- CreateIndex
CREATE INDEX "PriceListItem_priceListId_idx" ON "PriceListItem"("priceListId");

-- CreateIndex
CREATE INDEX "PriceListItem_productId_idx" ON "PriceListItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListItem_priceListId_productId_key" ON "PriceListItem"("priceListId", "productId");

-- CreateIndex (idempotent for databases that already have pre-operations schema)
CREATE INDEX IF NOT EXISTS "JobStructure_status_idx" ON "JobStructure"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Quote_priceListId_idx" ON "Quote"("priceListId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "JobStructure" ADD CONSTRAINT "JobStructure_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "JobStructure" ADD CONSTRAINT "JobStructure_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Quote" ADD CONSTRAINT "Quote_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Quote" ADD CONSTRAINT "Quote_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_jobStructureId_fkey" FOREIGN KEY ("jobStructureId") REFERENCES "JobStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
ALTER TABLE "DeliveryTicket" ADD CONSTRAINT "DeliveryTicket_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTicket" ADD CONSTRAINT "DeliveryTicket_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTicket" ADD CONSTRAINT "DeliveryTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTicket" ADD CONSTRAINT "DeliveryTicket_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTicketLineItem" ADD CONSTRAINT "DeliveryTicketLineItem_deliveryTicketId_fkey" FOREIGN KEY ("deliveryTicketId") REFERENCES "DeliveryTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTicketLineItem" ADD CONSTRAINT "DeliveryTicketLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTicketLineItem" ADD CONSTRAINT "DeliveryTicketLineItem_quoteLineItemId_fkey" FOREIGN KEY ("quoteLineItemId") REFERENCES "QuoteLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTicketLineItem" ADD CONSTRAINT "DeliveryTicketLineItem_jobStructureId_fkey" FOREIGN KEY ("jobStructureId") REFERENCES "JobStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyProductionLine" ADD CONSTRAINT "DailyProductionLine_productionEntryId_fkey" FOREIGN KEY ("productionEntryId") REFERENCES "DailyProductionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyProductionLine" ADD CONSTRAINT "DailyProductionLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_deliveryTicketId_fkey" FOREIGN KEY ("deliveryTicketId") REFERENCES "DeliveryTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_quoteLineItemId_fkey" FOREIGN KEY ("quoteLineItemId") REFERENCES "QuoteLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_deliveryTicketLineItemId_fkey" FOREIGN KEY ("deliveryTicketLineItemId") REFERENCES "DeliveryTicketLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
