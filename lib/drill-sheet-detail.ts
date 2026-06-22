import { Prisma } from "@/app/generated/prisma/client";
import type { DrillSheetPreviewMeta } from "@/components/drill-sheets/drill-sheet-preview";
import {
  type ComputedOpening,
  type ComputedSection,
  type DrillSheetResult,
} from "@/lib/drill-sheet";

export const drillSheetDetailInclude = {
  structureTemplate: { select: { name: true } },
  manholeDetail: true,
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
  pipeType: string;
  pipeDiameterInches: string;
  invertElevation: string;
  hasBoot: boolean;
  angle: string;
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
  rimElevation: string;
  hasKeyOverride: "auto" | "yes" | "no";
  brickOverride: string;
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

/**
 * Rebuilds the editable form state from a persisted drill sheet. The diameter is
 * matched back to the template by its inside diameter (feet); the brick override
 * is only surfaced when it differs from the template minimum so unchanged sheets
 * keep using the template default.
 */
export function buildDrillSheetFormValues(
  sheet: DrillSheetWithDetail,
  diameters: { id: string; insideDiameterFeet: number }[],
  templateMinimumBrickFeet: number | null,
): DrillSheetFormValues {
  const detail = sheet.manholeDetail;

  const insideDiameter = detail ? num(detail.insideDiameter) : null;
  const matchedDiameter =
    insideDiameter != null
      ? diameters.find(
          (diameter) =>
            Math.abs(diameter.insideDiameterFeet - insideDiameter) < 1e-6,
        )
      : undefined;

  const storedBrick = detail ? num(detail.brickAdjustmentFeet) : null;
  const brickOverride =
    storedBrick != null &&
    templateMinimumBrickFeet != null &&
    Math.abs(storedBrick - templateMinimumBrickFeet) > 1e-6
      ? String(storedBrick)
      : "";

  return {
    templateId: sheet.structureTemplateId ?? "",
    diameterId: matchedDiameter?.id ?? diameters[0]?.id ?? "",
    castingProductId: sheet.castings[0]?.castingProductId ?? "",
    jobId: sheet.jobId ?? "",
    manholeNumber: sheet.structureNumber ?? "",
    contractor: detail?.contractorName ?? "",
    project: detail?.projectName ?? "",
    date: toDateInputValue(detail?.sheetDate ?? null),
    hasSteps: detail?.hasSteps ?? false,
    rimElevation: decimalToInput(detail?.rimElevation ?? null),
    hasKeyOverride: "auto",
    brickOverride,
    openings: sheet.openings.map((opening) => ({
      label: opening.wallLocation ?? "",
      pipeType: opening.pipeType ?? "",
      pipeDiameterInches: decimalToInput(opening.pipeDiameter),
      invertElevation: decimalToInput(opening.invertElevation),
      hasBoot: opening.bootType != null,
      angle: decimalToInput(opening.angle),
    })),
  };
}

/**
 * Rebuilds the `{ meta, result }` shape consumed by the preview and the PDF from
 * a persisted `JobStructure` (with manholeDetail, openings, sections, castings,
 * and structureTemplate included). Returns `null` if the manhole detail is
 * missing, which means it is not a circular drill sheet.
 */
export function buildDrillSheetDetail(
  sheet: DrillSheetWithDetail,
): DrillSheetDetail | null {
  const detail = sheet.manholeDetail;
  if (!detail) {
    return null;
  }

  const lowInvert = num(detail.lowestInvertElevation);

  const openings: ComputedOpening[] = sheet.openings.map((opening) => {
    const invert = num(opening.invertElevation);
    return {
      label: opening.wallLocation ?? "",
      pipeType: opening.pipeType,
      pipeDiameterInches: num(opening.pipeDiameter),
      invertElevation: invert,
      hasBoot: opening.bootType != null,
      angleDegrees: num(opening.angle),
      holeDiameterInches: num(opening.holeDiameter),
      isLowInvert:
        invert != null &&
        lowInvert != null &&
        Math.abs(invert - lowInvert) < 1e-6,
    };
  });

  const sections: ComputedSection[] = sheet.sections.map((section) => ({
    role: section.role as "BASE" | "RISER",
    heightFeet: Number(section.heightFeet),
    label: section.label,
  }));

  const invertToTop = num(detail.invertToTopFeet);
  const castingHeight = num(detail.castingHeightFeet) ?? 0;
  const topSlab = num(detail.topSlabHeightFeet) ?? 0;
  const sump = num(detail.sumpFeet) ?? 0;
  const availableFeet =
    invertToTop != null
      ? Math.round((invertToTop - castingHeight - topSlab + sump) * 10000) /
        10000
      : null;

  const result: DrillSheetResult = {
    rimElevation: num(detail.rimElevation),
    lowInvertElevation: lowInvert,
    invertToTopFeet: invertToTop,
    castingHeightFeet: castingHeight,
    topSlabHeightFeet: topSlab,
    sumpFeet: sump,
    availableFeet,
    wallHeightFeet: num(detail.requiredWallHeight) ?? 0,
    brickAdjustmentFeet: num(detail.brickAdjustmentFeet) ?? 0,
    hasKey: detail.hasKey,
    sections,
    openings,
    warnings: [],
  };

  const meta: DrillSheetPreviewMeta = {
    templateName: sheet.structureTemplate?.name ?? "",
    manholeNumber: sheet.structureNumber ?? "",
    contractor: detail.contractorName ?? "",
    project: detail.projectName ?? "",
    date: detail.sheetDate
      ? new Intl.DateTimeFormat("en-US").format(detail.sheetDate)
      : "",
    castingName: sheet.castings[0]?.castingDescription ?? "",
    insideDiameterFeet: num(detail.insideDiameter),
    hasSteps: detail.hasSteps,
  };

  return { meta, result };
}
