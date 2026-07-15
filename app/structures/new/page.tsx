import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StructureTemplateForm } from "@/components/structures/structure-template-form";
import {
  createStructureTemplate,
  loadCastingProductOptions,
} from "@/app/structures/actions";
import { prisma } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
export default async function NewStructureTemplatePage() {
  const [castingOptions, rectPdfSets] = await Promise.all([
    loadCastingProductOptions(),
    prisma.rectSheetPdfSet.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, shape: true },
    }),
  ]);

  return (
    <DashboardShell
      title="New Structure Template"
      subtitle="Define thicknesses, casting, connection type, and offered diameters."
    >
      <BackButton href="/structures" label="Back to Structures" />

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
