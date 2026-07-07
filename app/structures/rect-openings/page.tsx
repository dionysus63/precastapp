import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  RectOpeningSizesForm,
  type RectOpeningRow,
} from "@/components/structures/rect-opening-sizes-form";
import { saveRectOpeningSizes } from "@/app/structures/rect-openings/actions";
import { prisma } from "@/lib/prisma";

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
    pricePerOpening:
      entry.pricePerOpening != null ? String(entry.pricePerOpening) : "",
  }));

  return (
    <DashboardShell
      title="Rectangular Opening Sizes"
      subtitle="Global catalog: pipe material/type + size → block-out opening width and height for rectangular structures."
    >
      <Link
        href="/structures"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Structures
      </Link>

      <div className="mt-4">
        <RectOpeningSizesForm
          action={saveRectOpeningSizes}
          defaultRows={defaultRows}
        />
      </div>
    </DashboardShell>
  );
}
