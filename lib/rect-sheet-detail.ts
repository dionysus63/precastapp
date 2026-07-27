import { Prisma } from "@/app/generated/prisma/client";
import type {
  RectOpeningField,
  RectSectionField,
  RectSheetFormValues,
} from "@/components/drill-sheets/rect-sheet-form";
import type { RectQuoteStructureConfig } from "@/lib/quotes/rect-structure-workbook";
import type { RectOpeningPlacement, RectWall } from "@/lib/rect-structure";
import type { RectSheetPayload } from "@/lib/rect-sheet-persistence";

export const rectSheetDetailInclude = {
  structureTemplate: {
    select: {
      id: true,
      name: true,
      agencyStandard: true,
      shape: true,
      rectPdfSet: { include: { files: true } },
    },
  },
  calc: true,
  dimensions: true,
  openings: { orderBy: { openingNumber: "asc" } },
  sections: { orderBy: { sortOrder: "asc" } },
  castings: true,
} satisfies Prisma.JobStructureInclude;

export type RectSheetWithDetail = Prisma.JobStructureGetPayload<{
  include: typeof rectSheetDetailInclude;
}>;

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

let fieldId = 0;
function nextId(): string {
  fieldId += 1;
  return `rect-field-${fieldId}`;
}

/**
 * Rebuilds the sheet form's initial values from the stored JobStructure so
 * the edit page re-enters exactly what was saved. The stored rows keep the
 * raw inputs (inverts, placements, splits); everything derived is recomputed
 * live by the form.
 */
export function buildRectSheetFormValues(
  sheet: RectSheetWithDetail,
): RectSheetFormValues {
  const calc = sheet.calc;
  const dims = sheet.dimensions;

  const openings: RectOpeningField[] = sheet.openings.map((opening) => {
    const catalogWidth = num(opening.openingWidthInches);
    return {
      id: nextId(),
      label: opening.label ?? "",
      wall: (opening.wall ?? "") as RectWall | "",
      pipeMaterial: opening.pipeMaterial ?? "",
      pipeSizeInches: decimalToInput(opening.pipeSizeInches),
      invertElevation: decimalToInput(opening.invertElevation),
      angle: decimalToInput(opening.angle),
      placement: (opening.horizontalPlacement ??
        "CENTERED") as RectOpeningPlacement,
      offsetInches: decimalToInput(opening.offsetInches),
      // The stored width includes any manual skew override; re-entering it as
      // the override keeps the saved width even if the catalog changes. The
      // form treats it as "no override" when it matches the catalog lookup.
      widthOverrideInches: catalogWidth != null ? String(catalogWidth) : "",
    };
  });

  const sections: RectSectionField[] =
    sheet.sections.length > 1
      ? sheet.sections.map((section) => ({
          id: nextId(),
          heightFeet: decimalToInput(section.heightFeet),
          topKey: section.hasTopKey,
        }))
      : [];

  return {
    templateId: sheet.structureTemplateId ?? "",
    castingProductId: sheet.castings[0]?.castingProductId ?? "",
    jobId: sheet.jobId ?? "",
    structureNumber: sheet.structureNumber ?? "",
    contractor: calc?.contractorName ?? "",
    project: calc?.projectName ?? "",
    date: toDateInputValue(calc?.sheetDate ?? null),
    inspection: calc?.inspection ?? "",
    approvedBy: calc?.approvedBy ?? "",
    rimElevation: decimalToInput(calc?.rimElevation ?? null),
    // Rect sheets store the manual brick target (inches) in the shared
    // brick-adjustment column.
    brickTargetInches: calc?.brickAdjustment ?? "",
    insideLengthFeet: decimalToInput(
      dims?.insideLength ?? calc?.insideLengthFeet ?? null,
    ),
    insideWidthFeet: decimalToInput(
      dims?.insideWidth ?? calc?.insideWidthFeet ?? null,
    ),
    hasTopSlab: dims?.hasTopSlab ?? true,
    hasBaseSlab: dims?.hasBaseSlab ?? true,
    baseAttached: dims?.baseAttached ?? true,
    topSlabOpeningLengthInches: decimalToInput(
      dims?.topSlabOpeningLengthInches ?? null,
    ),
    topSlabOpeningWidthInches: decimalToInput(
      dims?.topSlabOpeningWidthInches ?? null,
    ),
    topSlabOpeningSide: (dims?.topSlabOpeningSide ?? "UP") as RectWall,
    maxPickWeightLbs: "",
    sections,
    openings,
  };
}

/** Identity fields for seeding a new sheet from a placeholder structure. */
export type RectSheetSeedIdentity = {
  jobId: string | null;
  structureNumber: string | null;
  contractor: string;
  project: string;
};

function emptyOpeningField(label: string): RectOpeningField {
  return {
    id: nextId(),
    label,
    wall: "UP",
    pipeMaterial: "",
    pipeSizeInches: "",
    invertElevation: "",
    angle: "",
    placement: "CENTERED",
    offsetInches: "",
    widthOverrideInches: "",
  };
}

/**
 * Blank sheet form seeded with just the placeholder's identity — used when a
 * placeholder has no parseable quote config (manual structure or deleted
 * quote line).
 */
export function buildRectSheetFormValuesForIdentity(
  seed: RectSheetSeedIdentity,
): RectSheetFormValues {
  return {
    templateId: "",
    castingProductId: "",
    jobId: seed.jobId ?? "",
    structureNumber: seed.structureNumber ?? "",
    contractor: seed.contractor,
    project: seed.project,
    date: toDateInputValue(new Date()),
    inspection: "",
    approvedBy: "",
    rimElevation: "",
    brickTargetInches: "",
    insideLengthFeet: "",
    insideWidthFeet: "",
    hasTopSlab: true,
    hasBaseSlab: true,
    baseAttached: true,
    topSlabOpeningLengthInches: "",
    topSlabOpeningWidthInches: "",
    topSlabOpeningSide: "UP",
    maxPickWeightLbs: "",
    sections: [],
    openings: [emptyOpeningField("A")],
  };
}

/**
 * Seeds the sheet form from a quote-only rect config so completing the drill
 * sheet starts from everything the estimator already entered: template, size,
 * casting, rim/invert, slab flags, and the pipe list.
 */
export function buildRectSheetFormValuesFromQuoteConfig(
  config: RectQuoteStructureConfig,
  seed: RectSheetSeedIdentity,
): RectSheetFormValues {
  const hasPipeOpenings = config.openings.some(
    (opening) => opening.pipeMaterial && opening.pipeSizeInches != null,
  );

  let openings: RectOpeningField[];
  if (!hasPipeOpenings && config.penetrations?.length) {
    // Quote-only: expand the pipe list into opening rows, first at the low
    // invert (mirrors upgradeRectRowToFull in the workbook).
    openings = [];
    for (const penetration of config.penetrations) {
      for (let index = 0; index < penetration.qty; index += 1) {
        openings.push({
          ...emptyOpeningField(String.fromCharCode(65 + openings.length)),
          pipeMaterial: penetration.pipeMaterial,
          pipeSizeInches: String(penetration.pipeSizeInches),
          invertElevation:
            openings.length === 0 ? String(config.lowInvertElevation) : "",
        });
      }
    }
  } else {
    openings = config.openings.map((opening, index) => ({
      id: nextId(),
      label: opening.label || String.fromCharCode(65 + index),
      wall: opening.wall,
      pipeMaterial: opening.pipeMaterial ?? "",
      pipeSizeInches:
        opening.pipeSizeInches != null ? String(opening.pipeSizeInches) : "",
      invertElevation: String(opening.invertElevation),
      angle:
        opening.angleDegrees != null && opening.angleDegrees !== 0
          ? String(opening.angleDegrees)
          : "",
      placement: opening.placement ?? "CENTERED",
      offsetInches:
        opening.offsetInches != null ? String(opening.offsetInches) : "",
      widthOverrideInches:
        opening.widthOverrideInches != null
          ? String(opening.widthOverrideInches)
          : "",
    }));
  }

  if (openings.length === 0) {
    openings = [
      {
        ...emptyOpeningField("A"),
        invertElevation: String(config.lowInvertElevation),
      },
    ];
  }

  return {
    templateId: config.templateId,
    castingProductId: config.castingProductId ?? "",
    jobId: seed.jobId ?? "",
    structureNumber: seed.structureNumber ?? "",
    contractor: seed.contractor,
    project: seed.project,
    date: toDateInputValue(new Date()),
    inspection: "",
    approvedBy: "",
    rimElevation: String(config.rimElevation),
    brickTargetInches: "",
    insideLengthFeet: String(config.insideLengthFeet),
    insideWidthFeet: String(config.insideWidthFeet),
    hasTopSlab: config.hasTopSlab,
    hasBaseSlab: config.hasBaseSlab,
    baseAttached: config.baseAttached,
    topSlabOpeningLengthInches:
      config.topSlabOpeningLengthInches != null
        ? String(config.topSlabOpeningLengthInches)
        : "",
    topSlabOpeningWidthInches:
      config.topSlabOpeningWidthInches != null
        ? String(config.topSlabOpeningWidthInches)
        : "",
    topSlabOpeningSide: (config.topSlabOpeningSide ?? "UP") as RectWall,
    maxPickWeightLbs: "",
    sections: [],
    openings,
  };
}

/**
 * Assembles the server-action payload from form values so the detail page
 * can recompute through the exact pipeline the save actions use.
 */
export function rectPayloadFromFormValues(
  values: RectSheetFormValues,
): RectSheetPayload {
  return {
    templateId: values.templateId,
    castingProductId: values.castingProductId || null,
    jobId: values.jobId || null,
    structureNumber: values.structureNumber,
    contractor: values.contractor,
    project: values.project,
    date: values.date,
    inspection: values.inspection,
    approvedBy: values.approvedBy,
    rimElevation: values.rimElevation,
    brickTargetInches: values.brickTargetInches,
    insideLengthFeet: values.insideLengthFeet,
    insideWidthFeet: values.insideWidthFeet,
    hasTopSlab: values.hasTopSlab,
    hasBaseSlab: values.hasBaseSlab,
    baseAttached: values.baseAttached,
    topSlabOpeningLengthInches: values.topSlabOpeningLengthInches,
    topSlabOpeningWidthInches: values.topSlabOpeningWidthInches,
    topSlabOpeningSide: values.topSlabOpeningSide,
    sectionHeightsFeet: values.sections.map((section) => section.heightFeet),
    jointKeys: values.sections
      .slice(0, -1)
      .map((section) => section.topKey),
    openings: values.openings.map((opening) => ({
      label: opening.label,
      wall: opening.wall,
      pipeMaterial: opening.pipeMaterial,
      pipeSizeInches: opening.pipeSizeInches,
      invertElevation: opening.invertElevation,
      angle: opening.angle,
      placement: opening.placement,
      offsetInches: opening.offsetInches,
      widthOverrideInches: opening.widthOverrideInches,
    })),
  };
}
