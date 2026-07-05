-- Trigram + sort indexes for list search (see schema comments).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE INDEX "Customer_name_trgm_idx" ON "Customer" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Customer_primaryContactName_trgm_idx" ON "Customer" USING GIN ("primaryContactName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Customer_email_trgm_idx" ON "Customer" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "DeliveryTicket_ticketNumber_trgm_idx" ON "DeliveryTicket" USING GIN ("ticketNumber" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "DeliveryTicket_jobNumber_trgm_idx" ON "DeliveryTicket" USING GIN ("jobNumber" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "DeliveryTicket_customerName_trgm_idx" ON "DeliveryTicket" USING GIN ("customerName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "DeliveryTicket_projectName_trgm_idx" ON "DeliveryTicket" USING GIN ("projectName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "DeliveryTicket_truck_trgm_idx" ON "DeliveryTicket" USING GIN ("truck" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "DeliveryTicket_driver_trgm_idx" ON "DeliveryTicket" USING GIN ("driver" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Job_updatedAt_idx" ON "Job"("updatedAt");

-- CreateIndex
CREATE INDEX "Job_jobNumber_trgm_idx" ON "Job" USING GIN ("jobNumber" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Job_projectName_trgm_idx" ON "Job" USING GIN ("projectName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Job_customerName_trgm_idx" ON "Job" USING GIN ("customerName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Job_projectAddress_trgm_idx" ON "Job" USING GIN ("projectAddress" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Job_city_trgm_idx" ON "Job" USING GIN ("city" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Job_state_trgm_idx" ON "Job" USING GIN ("state" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Job_zip_trgm_idx" ON "Job" USING GIN ("zip" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Product_productCode_trgm_idx" ON "Product" USING GIN ("productCode" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Product_description_trgm_idx" ON "Product" USING GIN ("description" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Quote_updatedAt_idx" ON "Quote"("updatedAt");

-- CreateIndex
CREATE INDEX "Quote_quoteNumber_trgm_idx" ON "Quote" USING GIN ("quoteNumber" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Quote_jobNumber_trgm_idx" ON "Quote" USING GIN ("jobNumber" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Quote_customerName_trgm_idx" ON "Quote" USING GIN ("customerName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Quote_projectName_trgm_idx" ON "Quote" USING GIN ("projectName" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Quote_scopeLabel_trgm_idx" ON "Quote" USING GIN ("scopeLabel" gin_trgm_ops);
