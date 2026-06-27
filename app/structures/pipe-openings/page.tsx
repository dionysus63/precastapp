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
    pipeMaterial: entry.pipeMaterial,
    pipeSizeInches: String(entry.pipeSizeInches),
    pipeType: entry.pipeType,
    holeDiameterInches: String(entry.holeDiameterInches),
    bootModel: entry.bootModel ?? "",
    pricePerBoot:
      entry.pricePerBoot != null ? String(entry.pricePerBoot) : "",
  }));

  return (
    <DashboardShell
      title="Pipe Opening Sizes"
      subtitle="Global catalog: pipe material, size, and type → hole diameter, boot model, and price."
    >
      <Link
        href="/structures"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Structures
      </Link>

      <div className="mt-4">
        <PipeOpeningSizesForm
          action={savePipeOpeningSizes}
          defaultRows={defaultRows}
        />
      </div>
    </DashboardShell>
  );
}
