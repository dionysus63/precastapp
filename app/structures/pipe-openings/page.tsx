import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  PipeOpeningSizesForm,
  type PipeOpeningRow,
} from "@/components/structures/pipe-opening-sizes-form";
import { savePipeOpeningSizes } from "@/app/structures/pipe-openings/actions";
import { prisma } from "@/lib/prisma";

export default async function PipeOpeningSizesPage() {
  const entries = await prisma.pipeOpeningSize.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const defaultRows: PipeOpeningRow[] = entries.map((entry) => ({
    id: entry.id,
    // Legacy rows kept material and type separate; show them combined.
    pipeMaterial: [entry.pipeMaterial, entry.pipeType]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" "),
    pipeSizeInches: String(entry.pipeSizeInches),
    hasBoot: entry.hasBoot,
    holeDiameterInches: String(entry.holeDiameterInches),
    pipeWallThicknessInches:
      Number(entry.pipeWallThicknessInches) > 0
        ? String(entry.pipeWallThicknessInches)
        : "",
    bootModel: entry.bootModel ?? "",
    pricePerBoot:
      entry.pricePerBoot != null ? String(entry.pricePerBoot) : "",
  }));

  return (
    <DashboardShell
      title="Pipe Opening Sizes"
      subtitle="Global catalog: pipe material/type, size, and boot → hole diameter, pipe wall, boot model, and price."
    >
      <div className="flex items-center justify-between">
        <Link
          href="/structures"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Structures
        </Link>
        <Link
          href="/structures/import"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Bulk Import
        </Link>
      </div>

      <div className="mt-4">
        <PipeOpeningSizesForm
          action={savePipeOpeningSizes}
          defaultRows={defaultRows}
        />
      </div>
    </DashboardShell>
  );
}
