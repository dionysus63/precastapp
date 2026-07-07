import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  StructureTemplateForm,
  type StructureTemplateFormValue,
} from "@/components/structures/structure-template-form";
import { DeleteStructureTemplateButton } from "@/components/structures/delete-structure-template-button";
import { StructureTemplatePdfsSection } from "@/components/structures/structure-template-pdfs-section";
import {
  updateStructureTemplate,
  loadCastingProductOptions,
} from "@/app/structures/actions";
import { listTemplatePdfFields } from "@/lib/drill-sheet-template-pdf";
import { readTemplatePdfBytes } from "@/lib/structure-template-pdf-service";
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

  const [template, castingOptions, rectPdfSets] = await Promise.all([
    prisma.structureTemplate.findUnique({
      where: { id },
      include: {
        diameters: { orderBy: { sortOrder: "asc" } },
        rectSizes: { orderBy: { sortOrder: "asc" } },
        templatePdfs: { orderBy: [{ hasRiser: "asc" }, { hasKey: "asc" }] },
      },
    }),
    loadCastingProductOptions(),
    prisma.rectSheetPdfSet.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
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

  const isRect = template.shape === "RECTANGULAR";

  // Circular: one PDF per template — the app draws riser/key differences
  // (joints, section heights, elevations) onto the sheet itself.
  // Rectangular templates use shared PDF sets instead (Rect PDF Sets page).
  const existingPdf = template.templatePdfs[0] ?? null;

  const slotDefinitions = [
    {
      hasRiser: existingPdf?.hasRiser ?? false,
      hasKey: existingPdf?.hasKey ?? true,
      hasTopSlab: false,
      hasBaseSlab: false,
      label: "Drill Sheet Template PDF",
    },
  ];

  const pdfSlots = await Promise.all(
    slotDefinitions.map(async (slot) => {
      const pdf =
        template.templatePdfs.find(
          (row) =>
            row.hasRiser === slot.hasRiser && row.hasKey === slot.hasKey,
        ) ?? existingPdf;

      if (!pdf) {
        return { ...slot, pdf: null };
      }

      try {
        const bytes = await readTemplatePdfBytes(pdf);
        const coverage = await listTemplatePdfFields(bytes);

        return {
          ...slot,
          pdf: {
            id: pdf.id,
            originalName: pdf.originalName,
            fileSize: pdf.fileSize,
            uploadedAt: new Intl.DateTimeFormat("en-US").format(pdf.uploadedAt),
            coverage,
            loadError: null,
          },
        };
      } catch (error) {
        return {
          ...slot,
          pdf: {
            id: pdf.id,
            originalName: pdf.originalName,
            fileSize: pdf.fileSize,
            uploadedAt: new Intl.DateTimeFormat("en-US").format(pdf.uploadedAt),
            coverage: null,
            loadError:
              error instanceof Error
                ? error.message
                : "Could not read the uploaded template PDF.",
          },
        };
      }
    }),
  );

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
          expectedUpdatedAt={template.updatedAt.toISOString()}
          castingOptions={castingOptions}
          rectPdfSetOptions={rectPdfSets}
        />
      </div>

      {isRect ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          Sheet PDFs for rectangular templates come from the shared PDF set
          selected above. Manage the sets (and their four slab variants) in{" "}
          <Link
            href="/structures/rect-pdf-sets"
            className="font-semibold text-slate-800 underline"
          >
            Rect PDF Sets
          </Link>
          .
        </div>
      ) : (
        <div className="mt-6">
          <StructureTemplatePdfsSection
            templateId={template.id}
            slots={pdfSlots}
          />
        </div>
      )}
    </DashboardShell>
  );
}
