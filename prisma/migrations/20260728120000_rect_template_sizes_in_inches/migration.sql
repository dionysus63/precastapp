-- Rect template footprints move from decimal feet to whole inches so sizes
-- are exact at 1" increments (Decimal(6,2) feet cannot represent 1/12').
ALTER TABLE "StructureTemplateRectSize"
  ADD COLUMN "insideLengthInches" INTEGER,
  ADD COLUMN "insideWidthInches" INTEGER;

UPDATE "StructureTemplateRectSize"
SET "insideLengthInches" = ROUND("insideLengthFeet" * 12)::int,
    "insideWidthInches" = ROUND("insideWidthFeet" * 12)::int;

ALTER TABLE "StructureTemplateRectSize"
  ALTER COLUMN "insideLengthInches" SET NOT NULL,
  ALTER COLUMN "insideWidthInches" SET NOT NULL;

DROP INDEX "StructureTemplateRectSize_templateId_insideLengthFeet_insid_key";

ALTER TABLE "StructureTemplateRectSize"
  DROP COLUMN "insideLengthFeet",
  DROP COLUMN "insideWidthFeet";

CREATE UNIQUE INDEX "StructureTemplateRectSize_templateId_insideLengthInches_ins_key"
  ON "StructureTemplateRectSize"("templateId", "insideLengthInches", "insideWidthInches");
