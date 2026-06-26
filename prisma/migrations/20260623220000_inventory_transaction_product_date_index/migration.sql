-- CreateIndex
CREATE INDEX "InventoryTransaction_productId_transactionDate_idx" ON "InventoryTransaction"("productId", "transactionDate");
