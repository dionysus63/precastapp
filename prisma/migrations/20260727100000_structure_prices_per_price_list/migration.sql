-- Structure pricing moves from flat columns to per-price-list entry tables.
-- Order matters: create tables -> ensure a price list exists -> seed every
-- price list from the current flat columns -> drop the flat columns.

-- CreateTable
CREATE TABLE "DiameterPriceListEntry" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "diameterConfigId" TEXT NOT NULL,
    "wallPricePerFoot" DECIMAL(12,2) NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiameterPriceListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RectTemplatePriceListEntry" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "wallPricePerFoot" DECIMAL(12,2) NOT NULL,
    "topSlabPrice" DECIMAL(12,2) NOT NULL,
    "baseSlabPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RectTemplatePriceListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipeOpeningPriceListEntry" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "pipeOpeningSizeId" TEXT NOT NULL,
    "pricePerBoot" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipeOpeningPriceListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RectOpeningPriceListEntry" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "rectOpeningSizeId" TEXT NOT NULL,
    "pricePerOpening" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RectOpeningPriceListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiameterPriceListEntry_diameterConfigId_idx" ON "DiameterPriceListEntry"("diameterConfigId");
CREATE UNIQUE INDEX "DiameterPriceListEntry_priceListId_diameterConfigId_key" ON "DiameterPriceListEntry"("priceListId", "diameterConfigId");
CREATE INDEX "RectTemplatePriceListEntry_templateId_idx" ON "RectTemplatePriceListEntry"("templateId");
CREATE UNIQUE INDEX "RectTemplatePriceListEntry_priceListId_templateId_key" ON "RectTemplatePriceListEntry"("priceListId", "templateId");
CREATE INDEX "PipeOpeningPriceListEntry_pipeOpeningSizeId_idx" ON "PipeOpeningPriceListEntry"("pipeOpeningSizeId");
CREATE UNIQUE INDEX "PipeOpeningPriceListEntry_priceListId_pipeOpeningSizeId_key" ON "PipeOpeningPriceListEntry"("priceListId", "pipeOpeningSizeId");
CREATE INDEX "RectOpeningPriceListEntry_rectOpeningSizeId_idx" ON "RectOpeningPriceListEntry"("rectOpeningSizeId");
CREATE UNIQUE INDEX "RectOpeningPriceListEntry_priceListId_rectOpeningSizeId_key" ON "RectOpeningPriceListEntry"("priceListId", "rectOpeningSizeId");

-- AddForeignKey
ALTER TABLE "DiameterPriceListEntry" ADD CONSTRAINT "DiameterPriceListEntry_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiameterPriceListEntry" ADD CONSTRAINT "DiameterPriceListEntry_diameterConfigId_fkey" FOREIGN KEY ("diameterConfigId") REFERENCES "StructureDiameterConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RectTemplatePriceListEntry" ADD CONSTRAINT "RectTemplatePriceListEntry_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RectTemplatePriceListEntry" ADD CONSTRAINT "RectTemplatePriceListEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StructureTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PipeOpeningPriceListEntry" ADD CONSTRAINT "PipeOpeningPriceListEntry_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PipeOpeningPriceListEntry" ADD CONSTRAINT "PipeOpeningPriceListEntry_pipeOpeningSizeId_fkey" FOREIGN KEY ("pipeOpeningSizeId") REFERENCES "PipeOpeningSize"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RectOpeningPriceListEntry" ADD CONSTRAINT "RectOpeningPriceListEntry_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RectOpeningPriceListEntry" ADD CONSTRAINT "RectOpeningPriceListEntry_rectOpeningSizeId_fkey" FOREIGN KEY ("rectOpeningSizeId") REFERENCES "RectOpeningSize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure at least one price list exists so no prices are lost in the move.
INSERT INTO "PriceList" ("id", "name", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Standard', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "PriceList");

-- Seed every price list from the flat columns (all lists start identical).
INSERT INTO "DiameterPriceListEntry"
  ("id", "priceListId", "diameterConfigId", "wallPricePerFoot", "basePrice", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, pl."id", cfg."id", cfg."wallPricePerFoot", cfg."basePrice", NOW(), NOW()
FROM "PriceList" pl
CROSS JOIN "StructureDiameterConfig" cfg;

INSERT INTO "RectTemplatePriceListEntry"
  ("id", "priceListId", "templateId", "wallPricePerFoot", "topSlabPrice", "baseSlabPrice", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, pl."id", t."id",
       COALESCE(t."rectWallPricePerFoot", 0), COALESCE(t."rectTopSlabPrice", 0), COALESCE(t."rectBaseSlabPrice", 0),
       NOW(), NOW()
FROM "PriceList" pl
CROSS JOIN "StructureTemplate" t
WHERE t."shape" = 'RECTANGULAR';

INSERT INTO "PipeOpeningPriceListEntry"
  ("id", "priceListId", "pipeOpeningSizeId", "pricePerBoot", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, pl."id", pos."id", pos."pricePerBoot", NOW(), NOW()
FROM "PriceList" pl
CROSS JOIN "PipeOpeningSize" pos
WHERE pos."pricePerBoot" IS NOT NULL;

INSERT INTO "RectOpeningPriceListEntry"
  ("id", "priceListId", "rectOpeningSizeId", "pricePerOpening", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, pl."id", ros."id", ros."pricePerOpening", NOW(), NOW()
FROM "PriceList" pl
CROSS JOIN "RectOpeningSize" ros
WHERE ros."pricePerOpening" IS NOT NULL;

-- Drop the flat price columns now that entries carry the values.
ALTER TABLE "PipeOpeningSize" DROP COLUMN "pricePerBoot";
ALTER TABLE "RectOpeningSize" DROP COLUMN "pricePerOpening";
ALTER TABLE "StructureDiameterConfig" DROP COLUMN "basePrice",
DROP COLUMN "wallPricePerFoot";
ALTER TABLE "StructureTemplate" DROP COLUMN "rectBaseSlabPrice",
DROP COLUMN "rectTopSlabPrice",
DROP COLUMN "rectWallPricePerFoot";
