import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { StructureTemplateForm } from "@/components/structures/structure-template-form";
import {
  createStructureTemplate,
  loadCastingProductOptions,
} from "@/app/structures/actions";
import { prisma } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
export default async function NewStructureTemplatePage() {
  const [castingOptions, sheetPdfs, molds] = await Promise.all([
    loadCastingProductOptions(),
    prisma.sheetPdf.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        shape: true,
        hasTopSlab: true,
        hasBaseSlab: true,
      },
    }),
    prisma.structureDiameterConfig.findMany({
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const moldOptions = molds.map((mold) => ({
    label: mold.label,
    insideDiameterFeet: Number(mold.insideDiameterFeet),
    wallThicknessInches:
      mold.wallThicknessInches != null
        ? Number(mold.wallThicknessInches)
        : null,
    maxBaseHeightFeet: Number(mold.maxBaseHeightFeet),
    maxRiserHeightFeet: Number(mold.maxRiserHeightFeet),
    hasKey: mold.hasKey,
    sheetDiameterBasis: mold.sheetDiameterBasis,
  }));

  return (
    <DashboardShell
      title="New Structure Template"
    >
      <BackButton href="/structures" label="Back to Structures" />

      <div className="mt-3">
        <StructureTemplateForm
          action={createStructureTemplate}
          cancelHref="/structures"
          submitLabel="Create Template"
          castingOptions={castingOptions}
          sheetPdfOptions={sheetPdfs}
          moldOptions={moldOptions}
        />
      </div>
    </DashboardShell>
  );
}
