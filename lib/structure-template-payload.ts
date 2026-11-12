import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  sheetPdfFitsTemplate,
  sheetPdfKindLabel,
  type SheetPdfKind,
} from "@/lib/sheet-pdf";

export type StructureShape = "CIRCULAR" | "RECTANGULAR";
export type StructureTemplateStatus = "ACTIVE" | "INACTIVE";
export type PipeConnectionType = "KOR_N_SEAL" | "CAST_IN" | "GROUTED" | "OTHER";
export type SumpMode = "DEFAULT" | "FIXED";
export type RectWall = "UP" | "RIGHT" | "DOWN" | "LEFT";
const RECT_WALLS: readonly RectWall[] = ["UP", "RIGHT", "DOWN", "LEFT"];

type DiameterPayload = {
  insideDiameterFeet: number;
};

type RectSizePayload = {
  insideLengthInches: number;
  insideWidthInches: number;
};

export type TemplatePayload = {
  name: string;
  agencyStandard: string | null;
  shape: StructureShape;
  wallThicknessInches: number;
  baseSlabThicknessInches: number;
  topSlabThicknessInches: number;
  castingProductId: string | null;
  minimumBrickInches: number;
  connectionType: PipeConnectionType;
  sumpMode: SumpMode;
  sumpFixedInches: number | null;
  openingToJointMinTopInches: number;
  openingToJointMinBottomInches: number;
  /** Circular only: top slab clear opening in whole inches. */
  topSlabOpeningInches: number | null;
  rectWallPricePerFoot: number | null;
  rectMinPricingHeightFeet: number | null;
  /** Rectangular only: default top-slab access opening, inherited by structures. */
  rectTopSlabOpeningLengthInches: number | null;
  rectTopSlabOpeningWidthInches: number | null;
  rectTopSlabOpeningSide: RectWall | null;
  rectTopSlabPrice: number | null;
  rectBaseSlabPrice: number | null;
  /** The Sheet PDF the template's drill sheets print on. */
  sheetPdfId: string | null;
  status: StructureTemplateStatus;
  notes: string | null;
  diameters: DiameterPayload[];
  rectSizes: RectSizePayload[];
};

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(String(value));
}

function requirePositiveNumber(value: unknown, label: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return num;
}

function requireNonNegativeNumber(value: unknown, label: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
  return num;
}

function optionalNonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return num;
}

/**
 * Validates a plain template data object (from the template form's JSON
 * payload or a bulk-import row) into a TemplatePayload. Throws with a
 * user-readable message on the first problem found.
 */
export function parseTemplateData(data: Record<string, unknown>): TemplatePayload {
  const name = String(data.name ?? "").trim();
  if (!name) {
    throw new Error("Template name is required.");
  }

  const shape: StructureShape =
    data.shape === "RECTANGULAR" ? "RECTANGULAR" : "CIRCULAR";
  const status: StructureTemplateStatus =
    data.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  const connectionTypes: PipeConnectionType[] = [
    "KOR_N_SEAL",
    "CAST_IN",
    "GROUTED",
    "OTHER",
  ];
  const connectionType = connectionTypes.includes(
    data.connectionType as PipeConnectionType,
  )
    ? (data.connectionType as PipeConnectionType)
    : "KOR_N_SEAL";

  const sumpMode: SumpMode = data.sumpMode === "FIXED" ? "FIXED" : "DEFAULT";

  const diametersRaw =
    shape === "CIRCULAR" && Array.isArray(data.diameters) ? data.diameters : [];
  // A round template is built on one mold: exactly one inside diameter.
  // Sheets and quotes take the size from the template.
  if (shape === "CIRCULAR" && diametersRaw.length !== 1) {
    throw new Error(
      diametersRaw.length === 0
        ? "Pick the template's mold."
        : "A round template has exactly one mold. Duplicate the template for another size.",
    );
  }

  const diameters: DiameterPayload[] = diametersRaw.map((item, index) => {
    const row = item as Record<string, unknown>;
    return {
      insideDiameterFeet: requirePositiveNumber(
        row.insideDiameterFeet,
        `Diameter #${index + 1} inside diameter`,
      ),
    };
  });

  // A rectangular template is one mold/form: exactly one inside footprint.
  // Sheets and quotes take the size from the template and only pick height.
  const rectSizesRaw =
    shape === "RECTANGULAR" && Array.isArray(data.rectSizes)
      ? data.rectSizes
      : [];
  const rectSizes: RectSizePayload[] = [];
  rectSizesRaw.forEach((item) => {
    const row = item as Record<string, unknown>;
    // Footprints are whole inches; legacy callers (bulk import "4x6" cells)
    // still send feet, converted at 12"/ft and rounded to the nearest inch.
    const isBlank = (value: unknown) => value === "" || value == null;
    const lengthBlank =
      isBlank(row.insideLengthInches) && isBlank(row.insideLengthFeet);
    const widthBlank =
      isBlank(row.insideWidthInches) && isBlank(row.insideWidthFeet);
    if (lengthBlank && widthBlank) {
      return;
    }
    const inches = (
      inchesValue: unknown,
      feetValue: unknown,
      label: string,
    ): number => {
      if (!isBlank(inchesValue)) {
        const num = requirePositiveNumber(inchesValue, label);
        if (!Number.isInteger(num)) {
          throw new Error(`${label} must be whole inches.`);
        }
        return num;
      }
      return Math.round(requirePositiveNumber(feetValue, label) * 12);
    };
    rectSizes.push({
      insideLengthInches: inches(
        row.insideLengthInches,
        row.insideLengthFeet,
        "Inside length",
      ),
      insideWidthInches: inches(
        row.insideWidthInches,
        row.insideWidthFeet,
        "Inside width",
      ),
    });
  });

  if (shape === "RECTANGULAR" && rectSizes.length !== 1) {
    throw new Error(
      rectSizes.length === 0
        ? "Enter the template's inside length and width."
        : "A rectangular template has exactly one inside size.",
    );
  }

  return {
    name,
    agencyStandard: String(data.agencyStandard ?? "").trim() || null,
    shape,
    wallThicknessInches: requirePositiveNumber(
      data.wallThicknessInches,
      "Wall thickness",
    ),
    baseSlabThicknessInches: parseSlabThickness(
      shape,
      data.hasBaseSlab,
      data.baseSlabThicknessInches,
      "Base slab",
    ),
    topSlabThicknessInches: parseSlabThickness(
      shape,
      data.hasTopSlab,
      data.topSlabThicknessInches,
      "Top slab",
    ),
    castingProductId: data.castingProductId
      ? String(data.castingProductId)
      : null,
    minimumBrickInches: requireNonNegativeNumber(
      data.minimumBrickInches,
      "Minimum brick",
    ),
    connectionType,
    sumpMode,
    sumpFixedInches:
      sumpMode === "FIXED"
        ? requirePositiveNumber(data.sumpFixedInches, "Fixed sump distance")
        : optionalNonNegativeNumber(data.sumpFixedInches),
    openingToJointMinTopInches: requireNonNegativeNumber(
      data.openingToJointMinTopInches,
      "Opening-to-joint min (top)",
    ),
    openingToJointMinBottomInches: requireNonNegativeNumber(
      data.openingToJointMinBottomInches,
      "Opening-to-joint min (bottom)",
    ),
    topSlabOpeningInches: (() => {
      if (shape !== "CIRCULAR") {
        return null;
      }
      const value = optionalNonNegativeNumber(data.topSlabOpeningInches);
      if (value == null || value === 0) {
        return null;
      }
      if (!Number.isInteger(value)) {
        throw new Error("Top slab opening must be whole inches.");
      }
      return value;
    })(),
    rectWallPricePerFoot:
      shape === "RECTANGULAR"
        ? optionalNonNegativeNumber(data.rectWallPricePerFoot)
        : null,
    rectMinPricingHeightFeet:
      shape === "RECTANGULAR"
        ? optionalNonNegativeNumber(data.rectMinPricingHeightFeet)
        : null,
    ...parseRectTopSlabOpening(data, shape),
    rectTopSlabPrice:
      shape === "RECTANGULAR"
        ? optionalNonNegativeNumber(data.rectTopSlabPrice)
        : null,
    rectBaseSlabPrice:
      shape === "RECTANGULAR"
        ? optionalNonNegativeNumber(data.rectBaseSlabPrice)
        : null,
    sheetPdfId: data.sheetPdfId ? String(data.sheetPdfId) : null,
    status,
    notes: String(data.notes ?? "").trim() || null,
    diameters,
    rectSizes,
  };
}

/**
 * A slab's stored thickness. The template decides whether a rectangular
 * structure has each slab, and "no slab" is stored as a thickness of 0
 * (open top / open bottom). The template form sends the Top Slab / Base Slab
 * checkboxes as `hasTopSlab` / `hasBaseSlab`; callers that send no flag (the
 * spreadsheet import) keep the older rule that 0 or blank means no slab.
 * Round structures always have both slabs.
 */
function parseSlabThickness(
  shape: StructureShape,
  flag: unknown,
  value: unknown,
  label: string,
): number {
  if (shape !== "RECTANGULAR") {
    return requirePositiveNumber(value, `${label} thickness`);
  }
  if (flag === false) {
    return 0;
  }
  if (flag === true) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      throw new Error(
        `Enter the ${label.toLowerCase()} thickness, or uncheck ${label}.`,
      );
    }
    return num;
  }
  return requireNonNegativeNumber(value ?? 0, `${label} thickness`);
}

/**
 * The template decides the size and the slabs of every sheet built on it, so
 * once sheets exist neither may change: that would silently rebuild those
 * sheets as a different structure. (A legacy round template still listing
 * several diameters may be narrowed to one.)
 */
export function assertSizeAndSlabsUnchangedForSheets(
  existing: {
    shape: "CIRCULAR" | "RECTANGULAR";
    topSlabThicknessInches: unknown;
    baseSlabThicknessInches: unknown;
    diameters: { insideDiameterFeet: unknown }[];
    rectSizes: { insideLengthInches: unknown; insideWidthInches: unknown }[];
  },
  payload: TemplatePayload,
  sheetCount: number,
): void {
  if (sheetCount <= 0 || existing.shape !== payload.shape) {
    return;
  }
  const usedBy = `${sheetCount} drill sheet${sheetCount === 1 ? " uses" : "s use"} it`;
  if (payload.shape === "CIRCULAR") {
    const next = payload.diameters[0]?.insideDiameterFeet;
    if (
      existing.diameters.length === 1 &&
      next != null &&
      Math.abs(Number(existing.diameters[0].insideDiameterFeet) - next) > 1e-6
    ) {
      throw new Error(
        `This template's mold can't change while ${usedBy}. Duplicate it and change the copy instead.`,
      );
    }
    return;
  }
  // A legacy template saved without a size may still be given one.
  const currentSize = existing.rectSizes[0];
  const nextSize = payload.rectSizes[0];
  if (
    currentSize &&
    nextSize &&
    (Math.abs(Number(currentSize.insideLengthInches) - nextSize.insideLengthInches) > 1e-6 ||
      Math.abs(Number(currentSize.insideWidthInches) - nextSize.insideWidthInches) > 1e-6)
  ) {
    throw new Error(
      `This template's inside size can't change while ${usedBy}. Duplicate it and change the copy instead.`,
    );
  }
  if (
    templateHasSlab(existing.topSlabThicknessInches) !==
      templateHasSlab(payload.topSlabThicknessInches) ||
    templateHasSlab(existing.baseSlabThicknessInches) !==
      templateHasSlab(payload.baseSlabThicknessInches)
  ) {
    throw new Error(
      `This template's slabs can't change while ${usedBy}. Duplicate it and change the copy instead.`,
    );
  }
}

/** True when a template's stored slab thickness means the slab exists. */
export function templateHasSlab(thicknessInches: unknown): boolean {
  return Number(thicknessInches) > 0;
}

/**
 * Rect template top-slab opening: both sizes or neither. A zero clears the
 * default; the side falls back to Up when only the sizes are given.
 */
function parseRectTopSlabOpening(
  data: Record<string, unknown>,
  shape: StructureShape,
): Pick<
  TemplatePayload,
  | "rectTopSlabOpeningLengthInches"
  | "rectTopSlabOpeningWidthInches"
  | "rectTopSlabOpeningSide"
> {
  const empty = {
    rectTopSlabOpeningLengthInches: null,
    rectTopSlabOpeningWidthInches: null,
    rectTopSlabOpeningSide: null,
  };
  if (shape !== "RECTANGULAR") {
    return empty;
  }
  const length = optionalNonNegativeNumber(data.rectTopSlabOpeningLengthInches);
  const width = optionalNonNegativeNumber(data.rectTopSlabOpeningWidthInches);
  const hasLength = length != null && length > 0;
  const hasWidth = width != null && width > 0;
  if (!hasLength && !hasWidth) {
    return empty;
  }
  if (!hasLength || !hasWidth) {
    throw new Error(
      "Top slab opening needs both a length and a width (or leave both blank).",
    );
  }
  const rawSide = String(data.rectTopSlabOpeningSide ?? "").trim().toUpperCase();
  const side = (RECT_WALLS as readonly string[]).includes(rawSide)
    ? (rawSide as RectWall)
    : "UP";
  return {
    rectTopSlabOpeningLengthInches: length,
    rectTopSlabOpeningWidthInches: width,
    rectTopSlabOpeningSide: side,
  };
}

export function buildNestedCreate(payload: TemplatePayload) {
  return {
    name: payload.name,
    agencyStandard: payload.agencyStandard,
    shape: payload.shape,
    wallThicknessInches: decimal(payload.wallThicknessInches),
    baseSlabThicknessInches: decimal(payload.baseSlabThicknessInches),
    topSlabThicknessInches: decimal(payload.topSlabThicknessInches),
    castingProductId: payload.castingProductId,
    minimumBrickInches: decimal(payload.minimumBrickInches),
    connectionType: payload.connectionType,
    sumpMode: payload.sumpMode,
    sumpFixedInches:
      payload.sumpFixedInches === null
        ? null
        : decimal(payload.sumpFixedInches),
    openingToJointMinTopInches: decimal(payload.openingToJointMinTopInches),
    openingToJointMinBottomInches: decimal(
      payload.openingToJointMinBottomInches,
    ),
    topSlabOpeningInches: payload.topSlabOpeningInches,
    rectMinPricingHeightFeet:
      payload.rectMinPricingHeightFeet === null
        ? null
        : decimal(payload.rectMinPricingHeightFeet),
    rectTopSlabOpeningLengthInches:
      payload.rectTopSlabOpeningLengthInches === null
        ? null
        : decimal(payload.rectTopSlabOpeningLengthInches),
    rectTopSlabOpeningWidthInches:
      payload.rectTopSlabOpeningWidthInches === null
        ? null
        : decimal(payload.rectTopSlabOpeningWidthInches),
    rectTopSlabOpeningSide: payload.rectTopSlabOpeningSide,
    sheetPdfId: payload.sheetPdfId,
    status: payload.status,
    notes: payload.notes,
    diameters: {
      create: payload.diameters.map((diameter, index) => ({
        insideDiameterFeet: decimal(diameter.insideDiameterFeet),
        sortOrder: index,
      })),
    },
    rectSizes: {
      create: payload.rectSizes.map((size, index) => ({
        insideLengthInches: size.insideLengthInches,
        insideWidthInches: size.insideWidthInches,
        sortOrder: index,
      })),
    },
  };
}

/**
 * The rect wall/slab prices from a template payload as a price-list entry,
 * or null when the payload prices nothing (delete the list's entry).
 */
export function rectPriceEntryFromPayload(payload: TemplatePayload): {
  wallPricePerFoot: Prisma.Decimal;
  topSlabPrice: Prisma.Decimal;
  baseSlabPrice: Prisma.Decimal;
} | null {
  if (payload.shape !== "RECTANGULAR") {
    return null;
  }
  if (
    payload.rectWallPricePerFoot === null &&
    payload.rectTopSlabPrice === null &&
    payload.rectBaseSlabPrice === null
  ) {
    return null;
  }
  return {
    wallPricePerFoot: decimal(payload.rectWallPricePerFoot ?? 0),
    topSlabPrice: decimal(payload.rectTopSlabPrice ?? 0),
    baseSlabPrice: decimal(payload.rectBaseSlabPrice ?? 0),
  };
}

/** The template's shape and slabs, as a Sheet PDF has to match them. */
export function templateSheetPdfKind(template: {
  shape: StructureShape;
  topSlabThicknessInches: unknown;
  baseSlabThicknessInches: unknown;
}): SheetPdfKind {
  return {
    shape: template.shape === "CIRCULAR" ? "CIRCULAR" : "RECTANGULAR",
    hasTopSlab: templateHasSlab(template.topSlabThicknessInches),
    hasBaseSlab: templateHasSlab(template.baseSlabThicknessInches),
  };
}

/**
 * A template may only print on a Sheet PDF of its own shape and, for a
 * rectangular template, drawn for its slabs.
 */
export async function assertSheetPdfFitsTemplate(
  payload: TemplatePayload,
): Promise<void> {
  if (!payload.sheetPdfId) {
    return;
  }
  const sheetPdf = await prisma.sheetPdf.findUnique({
    where: { id: payload.sheetPdfId },
    select: { name: true, shape: true, hasTopSlab: true, hasBaseSlab: true },
  });
  if (!sheetPdf) {
    throw new Error(
      "The selected Sheet PDF no longer exists. Pick another one.",
    );
  }
  const templateKind = templateSheetPdfKind(payload);
  if (!sheetPdfFitsTemplate(sheetPdf, templateKind)) {
    throw new Error(
      `The Sheet PDF "${sheetPdf.name}" is ${sheetPdfKindLabel(sheetPdf)}, but this template is ${sheetPdfKindLabel(templateKind)}. Pick a Sheet PDF that matches.`,
    );
  }
}
