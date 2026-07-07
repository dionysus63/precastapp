import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StructureTemplateForm } from "@/components/structures/structure-template-form";
import {
  createStructureTemplate,
  loadCastingProductOptions,
} from "@/app/structures/actions";
import { prisma } from "@/lib/prisma";

export default async function NewStructureTemplatePage() {
  const [castingOptions, rectPdfSets] = await Promise.all([
    loadCastingProductOptions(),
    prisma.rectSheetPdfSet.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <DashboardShell
      title="New Structure Template"
      subtitle="Define thicknesses, casting, connection type, and offered diameters."
    >
      <Link
        href="/structures"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Structures
      </Link>

      <div className="mt-4">
        <StructureTemplateForm
          action={createStructureTemplate}
          cancelHref="/structures"
          submitLabel="Create Template"
          castingOptions={castingOptions}
          rectPdfSetOptions={rectPdfSets}
        />
      </div>
    </DashboardShell>
  );
}
