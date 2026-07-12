import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  SheetPdfSetManager,
  type SheetPdfSetSlotView,
  type SheetPdfSetView,
} from "@/components/structures/sheet-pdf-set-manager";
import { DRILL_SHEET_TEMPLATE_FIELD_NAMES } from "@/lib/drill-sheet-template-pdf";
import { RECT_SHEET_TEMPLATE_FIELD_NAMES } from "@/lib/rect-template-pdf-fields";
import { prisma } from "@/lib/prisma";

const RECT_SLOT_DEFINITIONS = [
  { hasTopSlab: true, hasBaseSlab: true, label: "Top Slab + Base Slab" },
  { hasTopSlab: true, hasBaseSlab: false, label: "Top Slab, No Base (Open Bottom)" },
  { hasTopSlab: false, hasBaseSlab: true, label: "No Top Slab + Base Slab" },
  { hasTopSlab: false, hasBaseSlab: false, label: "No Top Slab, No Base (Open Bottom)" },
];

// Circular sets hold one sheet: the app draws riser/key differences itself.
const CIRCULAR_SLOT_DEFINITIONS = [
  { hasTopSlab: false, hasBaseSlab: false, label: "Sheet PDF (all riser/key combos)" },
];

export default async function SheetPdfSetsPage() {
  const sets = await prisma.rectSheetPdfSet.findMany({
    orderBy: { name: "asc" },
    include: {
      files: true,
      templates: { select: { name: true }, orderBy: { name: "asc" } },
    },
  });

  // Field coverage is NOT computed here: parsing the PDFs inside a server
  // component render is pathologically slow in dev (~3.5s per file vs ~50ms
  // in a route handler), so the manager fetches each slot's coverage from
  // /api/rect-pdf-set-files/[id]/coverage after the page paints.
  const views: SheetPdfSetView[] = sets.map((set) => {
    // Tolerate a dev server still holding the pre-migration Prisma client.
    const shape = set.shape ?? "RECTANGULAR";
    const slotDefinitions =
      shape === "CIRCULAR" ? CIRCULAR_SLOT_DEFINITIONS : RECT_SLOT_DEFINITIONS;
    const slots: SheetPdfSetSlotView[] = slotDefinitions.map((slot) => {
      const file =
        set.files.find(
          (row) =>
            row.hasTopSlab === slot.hasTopSlab &&
            row.hasBaseSlab === slot.hasBaseSlab,
        ) ?? null;
      if (!file) {
        return { ...slot, file: null };
      }
      return {
        ...slot,
        file: {
          id: file.id,
          originalName: file.originalName,
          uploadedAt: new Intl.DateTimeFormat("en-US").format(file.uploadedAt),
        },
      };
    });
    return {
      id: set.id,
      name: set.name,
      shape,
      usedByTemplates: set.templates.map((template) => template.name),
      slots,
    };
  });

  return (
    <DashboardShell
      title="Sheet PDF Sets"
      subtitle="Fillable drill-sheet PDFs shared across structure templates — circular sets hold one sheet, rectangular sets hold the four slab variants."
    >
      <Link
        href="/structures"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Structures
      </Link>

      <div className="mt-4">
        <SheetPdfSetManager
          sets={views}
          expectedFieldNames={{
            CIRCULAR: [...DRILL_SHEET_TEMPLATE_FIELD_NAMES],
            RECTANGULAR: [...RECT_SHEET_TEMPLATE_FIELD_NAMES],
          }}
        />
      </div>
    </DashboardShell>
  );
}
