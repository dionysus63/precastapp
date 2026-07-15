import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  StructureTemplateForm,
  type StructureTemplateFormValue,
} from "@/components/structures/structure-template-form";
import { DeleteStructureTemplateButton } from "@/components/structures/delete-structure-template-button";
import {
  updateStructureTemplate,
  loadCastingProductOptions,
} from "@/app/structures/actions";
import { prisma } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
type EditStructureTemplatePageProps = {
  params: Promise<{ id: string }>;
};

function decimalToString(value: { toString(): string } | null): string {
  return value === null ? "" : String(value);
}

export default async function EditStructureTemplatePage({
  params,
}: EditStructureTemplatePageProps) {
  const { id } = await params;

  const [template, castingOptions, pdfSets] = await Promise.all([
    prisma.structureTemplate.findUnique({
      where: { id },
      include: {
        diameters: { orderBy: { sortOrder: "asc" } },
        rectSizes: { orderBy: { sortOrder: "asc" } },
      },
    }),
    loadCastingProductOptions(),
    prisma.rectSheetPdfSet.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, shape: true },
    }),
  ]);

  if (!template) {
    notFound();
  }

  const defaultValue: StructureTemplateFormValue = {
    name: template.name,
    agencyStandard: template.agencyStandard ?? "",
    shape: template.shape as "CIRCULAR" | "RECTANGULAR",
    wallThicknessInches: decimalToString(template.wallThicknessInches),
    baseSlabThicknessInches: decimalToString(template.baseSlabThicknessInches),
    topSlabThicknessInches: decimalToString(template.topSlabThicknessInches),
    castingProductId: template.castingProductId ?? "",
    minimumBrickInches: decimalToString(template.minimumBrickInches),
    connectionType: template.connectionType as StructureTemplateFormValue["connectionType"],
    sumpMode: template.sumpMode as "DEFAULT" | "FIXED",
    sumpFixedInches: decimalToString(template.sumpFixedInches),
    openingToJointMinTopInches: decimalToString(
      template.openingToJointMinTopInches,
    ),
    openingToJointMinBottomInches: decimalToString(
      template.openingToJointMinBottomInches,
    ),
    rectWallPricePerFoot: decimalToString(template.rectWallPricePerFoot),
    rectMinPricingHeightFeet: decimalToString(template.rectMinPricingHeightFeet),
    rectTopSlabPrice: decimalToString(template.rectTopSlabPrice),
    rectBaseSlabPrice: decimalToString(template.rectBaseSlabPrice),
    rectPdfSetId: template.rectPdfSetId ?? "",
    status: template.status as "ACTIVE" | "INACTIVE",
    notes: template.notes ?? "",
    diameters: template.diameters.map((diameter) => ({
      id: diameter.id,
      insideDiameterFeet: decimalToString(diameter.insideDiameterFeet),
    })),
    rectSizes: template.rectSizes.map((size) => ({
      id: size.id,
      insideLengthFeet: decimalToString(size.insideLengthFeet),
      insideWidthFeet: decimalToString(size.insideWidthFeet),
    })),
  };

  const updateAction = updateStructureTemplate.bind(null, template.id);

  return (
    <DashboardShell
      title={`Edit ${template.name}`}
      subtitle="Update template configuration and offered diameters."
    >
      <div className="flex items-center justify-between">
        <BackButton href="/structures" label="Back to Structures" />
        <DeleteStructureTemplateButton templateId={template.id} />
      </div>

      <div className="mt-4">
        <StructureTemplateForm
          action={updateAction}
          cancelHref="/structures"
          submitLabel="Save Changes"
          defaultValue={defaultValue}
          expectedUpdatedAt={template.updatedAt.toISOString()}
          castingOptions={castingOptions}
          rectPdfSetOptions={pdfSets}
        />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
        Drill sheet PDFs come from the shared sheet PDF set selected above
        {template.shape === "RECTANGULAR"
          ? " (four slab variants per set)"
          : " (one file per set; circular sheets without a set fall back to the generated layout)"}
        . Manage sets in{" "}
        <Link
          href="/structures/sheet-pdfs"
          className="font-semibold text-slate-800 underline"
        >
          Sheet PDF Sets
        </Link>
        .
      </div>
    </DashboardShell>
  );
}
