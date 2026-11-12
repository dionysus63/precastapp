import { BackButton } from "@/components/dashboard/back-button";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  SheetPdfManager,
  type SheetPdfView,
} from "@/components/structures/sheet-pdf-manager";
import { DRILL_SHEET_TEMPLATE_FIELD_NAMES } from "@/lib/drill-sheet-template-pdf";
import { RECT_SHEET_TEMPLATE_FIELD_NAMES } from "@/lib/rect-template-pdf-fields";
import { prisma } from "@/lib/prisma";

export default async function SheetPdfsPage() {
  const sheetPdfs = await prisma.sheetPdf.findMany({
    // Round first, then rectangular with the fullest slab combination first.
    orderBy: [
      { shape: "asc" },
      { hasTopSlab: "desc" },
      { hasBaseSlab: "desc" },
      { name: "asc" },
    ],
    include: {
      templates: { select: { name: true }, orderBy: { name: "asc" } },
    },
  });

  // The field check is NOT computed here: parsing the PDFs inside a server
  // component render is pathologically slow in dev (~3.5s per file vs ~50ms
  // in a route handler), so each row fetches its own from
  // /api/sheet-pdfs/[id]/coverage after the page paints.
  const views: SheetPdfView[] = sheetPdfs.map((sheetPdf) => ({
    id: sheetPdf.id,
    name: sheetPdf.name,
    shape: sheetPdf.shape === "CIRCULAR" ? "CIRCULAR" : "RECTANGULAR",
    hasTopSlab: sheetPdf.hasTopSlab,
    hasBaseSlab: sheetPdf.hasBaseSlab,
    originalName: sheetPdf.originalName,
    uploadedAt: new Intl.DateTimeFormat("en-US").format(sheetPdf.uploadedAt),
    version: sheetPdf.updatedAt.getTime(),
    usedByTemplates: sheetPdf.templates.map((template) => template.name),
  }));

  return (
    <DashboardShell
      title="Sheet PDFs"
      subtitle="One row is one blank fillable drawing. A template picks the one that matches its shape and slabs."
    >
      <BackButton href="/structures" label="Back to Structures" />

      <div className="mt-4">
        <SheetPdfManager
          sheetPdfs={views}
          expectedFieldNames={{
            CIRCULAR: [...DRILL_SHEET_TEMPLATE_FIELD_NAMES],
            RECTANGULAR: [...RECT_SHEET_TEMPLATE_FIELD_NAMES],
          }}
        />
      </div>
    </DashboardShell>
  );
}
