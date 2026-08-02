-- CreateTable
CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductGroup_parentId_idx" ON "ProductGroup"("parentId");

-- CreateIndex
CREATE INDEX "ProductGroup_sortOrder_idx" ON "ProductGroup"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductGroup_parentId_name_key" ON "ProductGroup"("parentId", "name");

-- CreateIndex
CREATE INDEX "ProductGroupMember_productId_idx" ON "ProductGroupMember"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductGroupMember_groupId_productId_key" ON "ProductGroupMember"("groupId", "productId");

-- AddForeignKey
ALTER TABLE "ProductGroup" ADD CONSTRAINT "ProductGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGroupMember" ADD CONSTRAINT "ProductGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGroupMember" ADD CONSTRAINT "ProductGroupMember_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
