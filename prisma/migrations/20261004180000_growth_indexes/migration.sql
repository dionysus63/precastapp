-- CreateIndex
CREATE INDEX "DailyProductionStructureLine_jobStructurePieceId_idx" ON "DailyProductionStructureLine"("jobStructurePieceId");

-- CreateIndex
CREATE INDEX "DeliveryTicket_status_deliveredAt_idx" ON "DeliveryTicket"("status", "deliveredAt");

-- CreateIndex
CREATE INDEX "DeliveryTicket_updatedAt_idx" ON "DeliveryTicket"("updatedAt");

-- CreateIndex
CREATE INDEX "DeliveryTicket_jobNumber_idx" ON "DeliveryTicket"("jobNumber");

-- CreateIndex
CREATE INDEX "DeliveryTicket_ticketType_paymentMethod_idx" ON "DeliveryTicket"("ticketType", "paymentMethod");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "Invoice_updatedAt_idx" ON "Invoice"("updatedAt");

-- CreateIndex
CREATE INDEX "Invoice_customerName_idx" ON "Invoice"("customerName");

-- CreateIndex
CREATE INDEX "Job_customerName_idx" ON "Job"("customerName");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE INDEX "JobFile_fileName_trgm_idx" ON "JobFile" USING GIN ("fileName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "JobStructure_status_createdAt_idx" ON "JobStructure"("status", "createdAt");

-- CreateIndex
CREATE INDEX "JobStructure_createdAt_idx" ON "JobStructure"("createdAt");

-- CreateIndex
CREATE INDEX "Quote_estimator_idx" ON "Quote"("estimator");
