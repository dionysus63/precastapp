import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  RectOpeningSizesForm,
  type RectOpeningRow,
} from "@/components/structures/rect-opening-sizes-form";
import { saveRectOpeningSizes } from "@/app/structures/rect-openings/actions";
import { prisma } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
export default async function RectOpeningSizesPage() {
  const entries = await prisma.rectOpeningSize.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const defaultRows: RectOpeningRow[] = entries.map((entry) => ({
    id: entry.id,
    pipeMaterial: entry.pipeMaterial,
    pipeSizeInches: String(entry.pipeSizeInches),
    openingWidthInches: String(entry.openingWidthInches),
    openingHeightInches: String(entry.openingHeightInches),
    pipeWallThicknessInches:
      Number(entry.pipeWallThicknessInches) > 0
        ? String(entry.pipeWallThicknessInches)
        : "",
    pricePerOpening:
      entry.pricePerOpening != null ? String(entry.pricePerOpening) : "",
  }));

  return (
    <DashboardShell
      title="Rectangular Opening Sizes"
      subtitle="Global catalog: pipe material/type + size → block-out opening width and height for rectangular structures."
    >
      <div className="flex items-center justify-between">
        <BackButton href="/structures" label="Back to Structures" />
        <Link
          href="/structures/import"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Bulk Import
        </Link>
      </div>

      <div className="mt-4">
        <RectOpeningSizesForm
          action={saveRectOpeningSizes}
          defaultRows={defaultRows}
        />
      </div>
    </DashboardShell>
  );
}
