import { Prisma } from "@/app/generated/prisma/client";
import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import {
  type ComputedOpening,
  type ComputedSection,
  computeBaseTopToOpeningBottomInches,
  type DrillSheetResult,
  getTopOfBottomSlabElevation,
  type PipeConnectionType,
} from "@/lib/drill-sheet";

export const drillSheetDetailInclude = {
  structureTemplate: {
    select: {
      name: true,
      agencyStandard: true,
      templatePdfs: true,
    },
  },
  calc: true,
  openings: { orderBy: { openingNumber: "asc" } },
  sections: { orderBy: { sortOrder: "asc" } },
  castings: true,
} satisfies Prisma.JobStructureInclude;

export type DrillSheetWithDetail = Prisma.JobStructureGetPayload<{
  include: typeof drillSheetDetailInclude;
}>;

export type DrillSheetDetail = {
  meta: DrillSheetPreviewMeta;
  result: DrillSheetResult;
};

export type DrillSheetFormOpening = {
  label: string;
  pipeMaterial: string;
  pipeSizeInches: string;
  pipeType: string;
  invertElevation: string;
  angle: string;
  connectionType: PipeConnectionType | "";
};

export type DrillSheetFormValues = {
  templateId: string;
  diameterId: string;
  castingProductId: string;
  jobId: string;
  manholeNumber: string;
  contractor: string;
  project: string;
  date: string;
  hasSteps: boolean;
  inspection: string;
  approvedBy: string;
  useBase: string;
  useRiser: string;
  brickAdjustment: string;
  rimElevation: string;
  openings: DrillSheetFormOpening[];
};

function num(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value);
}

function decimalToInput(value: { toString(): string } | null): string {
  const parsed = num(value);
  return parsed === null ? "" : String(parsed);
}

function toDateInputValue(date: Date | null): string {
  if (!date) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDrillSheetFormValues(
  sheet: DrillSheetWithDetail,
  diameters: { id: string; insideDiameterFeet: number }[],
): DrillSheetFormValues {
  const calc = sheet.calc;

  const insideDiameter = calc ? num(calc.insideDiameterFeet) : null;
  const matchedDiameter =
    insideDiameter != null
      ? diameters.find(
          (diameter) =>
            Math.abs(diameter.insideDiameterFeet - insideDiameter) < 1e-6,
        )
      : undefined;

  return {
    templateId: sheet.structureTemplateId ?? "",
    diameterId: matchedDiameter?.id ?? diameters[0]?.id ?? "",
    castingProductId: sheet.castings[0]?.castingProductId ?? "",
    jobId: sheet.jobId ?? "",
    manholeNumber: sheet.structureNumber ?? "",
    contractor: calc?.contractorName ?? "",
    project: calc?.projectName ?? "",
    date: toDateInputValue(calc?.sheetDate ?? null),
    hasSteps: calc?.hasSteps ?? false,
    inspection: calc?.inspection ?? "",
    approvedBy: calc?.approvedBy ?? "",
    useBase: calc?.useBase ?? "",
    useRiser: calc?.useRiser ?? "",
    brickAdjustment: calc?.brickAdjustment ?? "",
    rimElevation: decimalToInput(calc?.rimElevation ?? null),
    openings: sheet.openings.map((opening) => ({
      label: opening.label ?? "",
      pipeMaterial: opening.pipeMaterial ?? "",
      pipeSizeInches: decimalToInput(opening.pipeSizeInches),
      pipeType: opening.pipeType ?? "",
      invertElevation: decimalToInput(opening.invertElevation),
      angle: decimalToInput(opening.angle),
      connectionType: (opening.connectionType ?? "") as PipeConnectionType | "",
    })),
  };
}

export function buildDrillSheetDetail(
  sheet: DrillSheetWithDetail,
): DrillSheetDetail | null {
  const calc = sheet.calc;
  if (!calc) {
    return null;
  }

  const lowInvert = num(calc.lowestInvertFeet);
  const sumpFeet = num(calc.sumpFeet) ?? 0;
  const topOfBottomSlabFeet = getTopOfBottomSlabElevation(lowInvert, sumpFeet);

  const openings: ComputedOpening[] = sheet.openings.map((opening) => {
    const invert = num(opening.invertElevation);
    const bottomOfOpeningFeet = num(opening.bottomOfOpeningFeet);
    return {
      label: opening.label ?? "",
      pipeMaterial: opening.pipeMaterial,
      pipeSizeInches: num(opening.pipeSizeInches),
      pipeType: opening.pipeType,
      invertElevation: invert,
      angleDegrees: num(opening.angle),
      connectionType: opening.connectionType,
      holeDiameterInches: num(opening.holeDiameterInches),
      bootModel: opening.bootModel,
      pricePerBoot: num(opening.pricePerBoot),
      isLowInvert:
        invert != null &&
        lowInvert != null &&
        Math.abs(invert - lowInvert) < 1e-6,
      topOfPipeFeet: num(opening.topOfPipeFeet),
      bottomOfOpeningFeet,
      topOfOpeningFeet: num(opening.topOfOpeningFeet),
      baseTopToOpeningBottomInches: computeBaseTopToOpeningBottomInches(
        bottomOfOpeningFeet,
        topOfBottomSlabFeet,
      ),
    };
  });

  const sections: ComputedSection[] = sheet.sections.map((section) => ({
    role: section.role as "BASE" | "RISER",
    heightFeet: Number(section.heightFeet),
    label: section.label,
  }));

  const invertToTop =
    num(calc.rimElevation) != null && lowInvert != null
      ? Number(calc.rimElevation) - lowInvert
      : null;

  const result: DrillSheetResult = {
    rimElevation: num(calc.rimElevation),
    lowInvertElevation: lowInvert,
    invertToTopFeet: invertToTop,
    castingHeightFeet: num(calc.castingHeightFeet) ?? 0,
    topSlabThicknessFeet: num(calc.topSlabThicknessFeet) ?? 0,
    sumpFeet: num(calc.sumpFeet) ?? 0,
    rawAvailableFeet: null,
    wallHeightFeet: num(calc.wallHeightFeet) ?? 0,
    brickFeet: num(calc.brickFeet) ?? 0,
    hasKey: calc.hasKey,
    totalHeightFeet: num(calc.totalHeightFeet),
    baseSlabThicknessFeet: num(calc.baseSlabThicknessFeet),
    sections,
    openings,
    wallPrice: num(calc.wallPrice) ?? 0,
    bootsPrice: num(calc.bootsPrice) ?? 0,
    totalPrice: num(calc.totalPrice) ?? 0,
    errorMessage: calc.errorMessage,
    warnings: calc.errorMessage ? [calc.errorMessage] : [],
  };

  const meta: DrillSheetPreviewMeta = {
    templateName: sheet.structureTemplate?.name ?? "",
    manholeNumber: sheet.structureNumber ?? "",
    contractor: calc.contractorName ?? "",
    project: calc.projectName ?? "",
    date: calc.sheetDate
      ? new Intl.DateTimeFormat("en-US").format(calc.sheetDate)
      : "",
    castingName: sheet.castings[0]?.castingDescription ?? "",
    insideDiameterFeet: num(calc.insideDiameterFeet),
    hasSteps: calc.hasSteps,
    inspection: calc.inspection ?? "",
    approvedBy: calc.approvedBy ?? "",
    useBase: calc.useBase ?? "",
    useRiser: calc.useRiser ?? "",
    brickAdjustment: calc.brickAdjustment ?? "",
  };

  return { meta, result };
}
