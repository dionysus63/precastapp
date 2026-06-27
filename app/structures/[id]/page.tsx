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

  const [template, castingOptions] = await Promise.all([
    prisma.structureTemplate.findUnique({
      where: { id },
      include: {
        diameters: { orderBy: { sortOrder: "asc" } },
      },
    }),
    loadCastingProductOptions(),
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
    status: template.status as "ACTIVE" | "INACTIVE",
    notes: template.notes ?? "",
    diameters: template.diameters.map((diameter) => ({
      id: diameter.id,
      insideDiameterFeet: decimalToString(diameter.insideDiameterFeet),
    })),
  };

  const updateAction = updateStructureTemplate.bind(null, template.id);

  return (
    <DashboardShell
      title={`Edit ${template.name}`}
      subtitle="Update template configuration and offered diameters."
    >
      <div className="flex items-center justify-between">
        <Link
          href="/structures"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Structures
        </Link>
        <DeleteStructureTemplateButton templateId={template.id} />
      </div>

      <div className="mt-4">
        <StructureTemplateForm
          action={updateAction}
          cancelHref="/structures"
          submitLabel="Save Changes"
          defaultValue={defaultValue}
          castingOptions={castingOptions}
        />
      </div>
    </DashboardShell>
  );
}
