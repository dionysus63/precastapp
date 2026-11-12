-- Sheet PDFs replace Sheet PDF Sets.
--
-- A Sheet PDF is one blank fillable drawing. A template picks the one that
-- matches its shape and (rectangular) slabs, instead of picking a set whose
-- four slots covered every slab combination.
--
-- This migration only ADDS things: the old set tables and
-- "StructureTemplate"."rectPdfSetId" are left exactly as they are, so a
-- deploy that has to roll back to the previous build keeps working. The files
-- stay where they are in storage/rect-pdf-sets.

-- CreateTable
CREATE TABLE "SheetPdf" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shape" "StructureShape" NOT NULL,
    "hasTopSlab" BOOLEAN NOT NULL DEFAULT false,
    "hasBaseSlab" BOOLEAN NOT NULL DEFAULT false,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetPdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SheetPdf_name_key" ON "SheetPdf"("name");

-- CreateIndex
CREATE INDEX "SheetPdf_shape_idx" ON "SheetPdf"("shape");

-- AlterTable
ALTER TABLE "StructureTemplate" ADD COLUMN "sheetPdfId" TEXT;

-- CreateIndex
CREATE INDEX "StructureTemplate_sheetPdfId_idx" ON "StructureTemplate"("sheetPdfId");

-- AddForeignKey
ALTER TABLE "StructureTemplate" ADD CONSTRAINT "StructureTemplate_sheetPdfId_fkey" FOREIGN KEY ("sheetPdfId") REFERENCES "SheetPdf"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every uploaded set slot becomes one Sheet PDF. The row keeps the slot's id
-- and points at the slot's file, so nothing moves on disk. The path is built
-- from the set and slot ("<setId>/<variant>.pdf", where the app has always
-- read the file from) rather than copied, because some old rows still carry
-- an absolute path from before the files moved into storage/. A round set's
-- sheet is named after the set; a rectangular slot is named after its set and
-- slot. A number is added only if two rows would otherwise end up with the
-- same name.
INSERT INTO "SheetPdf" (
    "id", "name", "shape", "hasTopSlab", "hasBaseSlab",
    "filePath", "originalName", "fileSize", "uploadedAt", "updatedAt"
)
SELECT
    named."id",
    CASE WHEN named."copy" = 1 THEN named."name"
         ELSE named."name" || ' (' || named."copy" || ')' END,
    named."shape", named."hasTopSlab", named."hasBaseSlab",
    named."filePath", named."originalName", named."fileSize",
    named."uploadedAt", named."updatedAt"
FROM (
    SELECT
        slot.*,
        ROW_NUMBER() OVER (PARTITION BY slot."name" ORDER BY slot."uploadedAt", slot."id") AS "copy"
    FROM (
        SELECT
            f."id",
            CASE
                WHEN s."shape" = 'CIRCULAR' AND NOT f."hasTopSlab" AND NOT f."hasBaseSlab"
                    THEN s."name"
                ELSE s."name" || ' - '
                    || CASE WHEN f."hasTopSlab" THEN 'Top Slab' ELSE 'No Top Slab' END
                    || CASE WHEN f."hasBaseSlab" THEN ' + Base' ELSE ', No Base' END
            END AS "name",
            s."shape",
            -- A round sheet has no slab combination.
            (s."shape" = 'RECTANGULAR' AND f."hasTopSlab") AS "hasTopSlab",
            (s."shape" = 'RECTANGULAR' AND f."hasBaseSlab") AS "hasBaseSlab",
            f."setId" || '/'
                || CASE WHEN f."hasTopSlab" THEN 'topslab' ELSE 'notopslab' END
                || '-'
                || CASE WHEN f."hasBaseSlab" THEN 'base' ELSE 'nobase' END
                || '.pdf' AS "filePath",
            f."originalName", f."fileSize", f."uploadedAt", f."updatedAt"
        FROM "RectSheetPdfSetFile" f
        JOIN "RectSheetPdfSet" s ON s."id" = f."setId"
    ) slot
) named;

-- Rectangular templates take the slot of their set that matches their slabs
-- (a thickness of 0 means the template has no such slab).
UPDATE "StructureTemplate" t
SET "sheetPdfId" = f."id"
FROM "RectSheetPdfSetFile" f
JOIN "RectSheetPdfSet" s ON s."id" = f."setId"
WHERE t."rectPdfSetId" = s."id"
  AND t."shape" = 'RECTANGULAR'
  AND s."shape" = 'RECTANGULAR'
  AND f."hasTopSlab" = (t."topSlabThicknessInches" > 0)
  AND f."hasBaseSlab" = (t."baseSlabThicknessInches" > 0);

-- Round templates take their set's one sheet (the same pick the app made:
-- the plain slot first, else whatever the set holds).
UPDATE "StructureTemplate" t
SET "sheetPdfId" = (
    SELECT f."id"
    FROM "RectSheetPdfSetFile" f
    WHERE f."setId" = t."rectPdfSetId"
    ORDER BY (f."hasTopSlab" OR f."hasBaseSlab"), f."uploadedAt", f."id"
    LIMIT 1
)
FROM "RectSheetPdfSet" s
WHERE t."rectPdfSetId" = s."id"
  AND t."shape" = 'CIRCULAR'
  AND s."shape" = 'CIRCULAR';
