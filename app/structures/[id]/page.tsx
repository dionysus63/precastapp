import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  StructureTemplateForm,
  type StructureTemplateFormValue,
} from "@/components/structures/structure-template-form";
import { DeleteStructureTemplateButton } from "@/components/structures/delete-structure-template-button";
import { updateStructureTemplate } from "@/app/structures/actions";
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

  const template = await prisma.structureTemplate.findUnique({
    where: { id },
    include: {
      diameters: {
        orderBy: { sortOrder: "asc" },
        include: { sections: { orderBy: { sortOrder: "asc" } } },
      },
      bootSizes: { orderBy: { pipeDiameterInches: "asc" } },
    },
  });

  if (!template) {
    notFound();
  }

  const defaultValue: StructureTemplateFormValue = {
    name: template.name,
    agencyStandard: template.agencyStandard ?? "",
    shape: template.shape as "CIRCULAR" | "RECTANGULAR",
    minimumBrickFeet: decimalToString(template.minimumBrickFeet),
    keyClearanceFeet: decimalToString(template.keyClearanceFeet),
    status: template.status as "ACTIVE" | "INACTIVE",
    notes: template.notes ?? "",
    diameters: template.diameters.map((diameter) => ({
      id: diameter.id,
      insideDiameterFeet: decimalToString(diameter.insideDiameterFeet),
      moldMaxHeightFeet: decimalToString(diameter.moldMaxHeightFeet),
      topSlabHeightWithKeyFeet: decimalToString(
        diameter.topSlabHeightWithKeyFeet,
      ),
      topSlabHeightNoKeyFeet: decimalToString(diameter.topSlabHeightNoKeyFeet),
      sections: diameter.sections.map((section) => ({
        id: section.id,
        role: section.role as "BASE" | "RISER",
        heightFeet: decimalToString(section.heightFeet),
        label: section.label ?? "",
      })),
    })),
    bootSizes: template.bootSizes.map((boot) => ({
      id: boot.id,
      pipeDiameterInches: decimalToString(boot.pipeDiameterInches),
      holeDiameterInches: decimalToString(boot.holeDiameterInches),
    })),
  };

  const updateAction = updateStructureTemplate.bind(null, template.id);

  return (
    <DashboardShell
      title={`Edit ${template.name}`}
      subtitle="Update diameters, sections, top slabs, and boot sizes."
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
        />
      </div>
    </DashboardShell>
  );
}
