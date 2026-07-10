import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  RectPdfSetManager,
  type RectPdfSetSlotView,
  type RectPdfSetView,
} from "@/components/structures/rect-pdf-set-manager";
import { listTemplatePdfFields } from "@/lib/drill-sheet-template-pdf";
import { readRectPdfSetFileBytes } from "@/lib/rect-pdf-set-service";
import { rectVariantExpectedFieldNames } from "@/lib/rect-template-pdf-fields";
import { prisma } from "@/lib/prisma";

const SLOT_DEFINITIONS = [
  { hasTopSlab: true, hasBaseSlab: true, label: "Top Slab + Base Slab" },
  { hasTopSlab: true, hasBaseSlab: false, label: "Top Slab, No Base (Open Bottom)" },
  { hasTopSlab: false, hasBaseSlab: true, label: "No Top Slab + Base Slab" },
  { hasTopSlab: false, hasBaseSlab: false, label: "No Top Slab, No Base (Open Bottom)" },
];

export default async function RectPdfSetsPage() {
  const sets = await prisma.rectSheetPdfSet.findMany({
    orderBy: { name: "asc" },
    include: {
      files: true,
      templates: { select: { name: true }, orderBy: { name: "asc" } },
    },
  });

  const views: RectPdfSetView[] = await Promise.all(
    sets.map(async (set) => {
      const slots: RectPdfSetSlotView[] = await Promise.all(
        SLOT_DEFINITIONS.map(async (slot) => {
          const file =
            set.files.find(
              (row) =>
                row.hasTopSlab === slot.hasTopSlab &&
                row.hasBaseSlab === slot.hasBaseSlab,
            ) ?? null;
          if (!file) {
            return { ...slot, file: null };
          }
          try {
            const bytes = await readRectPdfSetFileBytes(file);
            const coverage = await listTemplatePdfFields(
              bytes,
              rectVariantExpectedFieldNames(slot.hasTopSlab, slot.hasBaseSlab),
            );
            return {
              ...slot,
              file: {
                id: file.id,
                originalName: file.originalName,
                uploadedAt: new Intl.DateTimeFormat("en-US").format(
                  file.uploadedAt,
                ),
                matched: coverage.matched.length,
                unmatched: coverage.unmatched,
                missing: coverage.missingFromPdf,
                loadError: null,
              },
            };
          } catch (error) {
            return {
              ...slot,
              file: {
                id: file.id,
                originalName: file.originalName,
                uploadedAt: new Intl.DateTimeFormat("en-US").format(
                  file.uploadedAt,
                ),
                matched: 0,
                unmatched: [],
                missing: [],
                loadError:
                  error instanceof Error
                    ? error.message
                    : "Could not read the uploaded PDF.",
              },
            };
          }
        }),
      );
      return {
        id: set.id,
        name: set.name,
        usedByTemplates: set.templates.map((template) => template.name),
        slots,
      };
    }),
  );

  return (
    <DashboardShell
      title="Rect Sheet PDF Sets"
      subtitle="Calibrated sheet PDFs (one per slab variant) shared across rectangular structure templates."
    >
      <Link
        href="/structures"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Structures
      </Link>

      <div className="mt-4">
        <RectPdfSetManager sets={views} />
      </div>
    </DashboardShell>
  );
}
