-- AlterTable
ALTER TABLE "RectSheetPdfSet" ADD COLUMN     "shape" "StructureShape" NOT NULL DEFAULT 'RECTANGULAR';

-- CreateIndex
CREATE INDEX "RectSheetPdfSet_shape_idx" ON "RectSheetPdfSet"("shape");
