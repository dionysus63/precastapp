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
  duplicateStructureTemplate,
  loadCastingProductOptions,
} from "@/app/structures/actions";
import {
  PriceListSwitcher,
  pickSelectedPriceList,
} from "@/components/structures/price-list-switcher";
import { prisma } from "@/lib/prisma";
import { listPriceListOptions } from "@/lib/price-list-service";

import { BackButton } from "@/components/dashboard/back-button";
type EditStructureTemplatePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ priceList?: string }>;
};

function decimalToString(value: { toString(): string } | null): string {
  return value === null ? "" : String(value);
}

export default async function EditStructureTemplatePage({
  params,
  searchParams,
}: EditStructureTemplatePageProps) {
  const { id } = await params;
  const { priceList } = await searchParams;

  const [template, castingOptions, pdfSets, molds, priceLists] = await Promise.all([
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
    prisma.structureDiameterConfig.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    listPriceListOptions(),
  ]);

  if (!template) {
    notFound();
  }

  const selectedPriceList = pickSelectedPriceList(priceLists, priceList);
  const rectPriceEntry = selectedPriceList
    ? await prisma.rectTemplatePriceListEntry.findUnique({
        where: {
          priceListId_templateId: {
            priceListId: selectedPriceList.id,
            templateId: template.id,
          },
        },
      })
    : null;

  const moldOptions = molds.map((mold) => ({
    label: mold.label,
    insideDiameterFeet: Number(mold.insideDiameterFeet),
    wallThicknessInches:
      mold.wallThicknessInches != null
        ? Number(mold.wallThicknessInches)
        : null,
    maxBaseHeightFeet: Number(mold.maxBaseHeightFeet),
    maxRiserHeightFeet: Number(mold.maxRiserHeightFeet),
  }));

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
    rectWallPricePerFoot: rectPriceEntry
      ? String(rectPriceEntry.wallPricePerFoot)
      : "",
    rectMinPricingHeightFeet: decimalToString(template.rectMinPricingHeightFeet),
    rectTopSlabPrice: rectPriceEntry ? String(rectPriceEntry.topSlabPrice) : "",
    rectBaseSlabPrice: rectPriceEntry
      ? String(rectPriceEntry.baseSlabPrice)
      : "",
    rectPdfSetId: template.rectPdfSetId ?? "",
    status: template.status as "ACTIVE" | "INACTIVE",
    notes: template.notes ?? "",
    diameters: template.diameters.map((diameter) => ({
      id: diameter.id,
      insideDiameterFeet: decimalToString(diameter.insideDiameterFeet),
    })),
    rectSizes: template.rectSizes.map((size) => ({
      id: size.id,
      insideLengthInches: String(size.insideLengthInches),
      insideWidthInches: String(size.insideWidthInches),
    })),
  };

  const updateAction = updateStructureTemplate.bind(null, template.id);

  return (
    <DashboardShell
      title={`Edit ${template.name}`}
      subtitle="Update template configuration and offered diameters."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton href="/structures" label="Back to Structures" />
        <div className="flex flex-wrap items-center gap-3">
          {template.shape === "RECTANGULAR" ? (
            <PriceListSwitcher
              priceLists={priceLists}
              selectedId={selectedPriceList?.id ?? null}
              basePath={`/structures/${template.id}`}
            />
          ) : null}
          <form action={duplicateStructureTemplate.bind(null, template.id)}>
            <button
              type="submit"
              title={`Create a copy of ${template.name}`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Duplicate
            </button>
          </form>
          <DeleteStructureTemplateButton templateId={template.id} />
        </div>
      </div>

      <div className="mt-4">
        <StructureTemplateForm
          key={selectedPriceList?.id ?? "no-list"}
          action={updateAction}
          cancelHref="/structures"
          submitLabel="Save Changes"
          defaultValue={defaultValue}
          expectedUpdatedAt={template.updatedAt.toISOString()}
          castingOptions={castingOptions}
          rectPdfSetOptions={pdfSets}
          moldOptions={moldOptions}
          priceListId={selectedPriceList?.id ?? null}
          priceListName={selectedPriceList?.name ?? null}
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
