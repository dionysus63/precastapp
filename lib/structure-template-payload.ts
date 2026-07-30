import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type StructureShape = "CIRCULAR" | "RECTANGULAR";
export type StructureTemplateStatus = "ACTIVE" | "INACTIVE";
export type PipeConnectionType = "KOR_N_SEAL" | "CAST_IN" | "GROUTED" | "OTHER";
export type SumpMode = "DEFAULT" | "FIXED";

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
  rectTopSlabPrice: number | null;
  rectBaseSlabPrice: number | null;
  rectPdfSetId: string | null;
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
  if (shape === "CIRCULAR" && diametersRaw.length === 0) {
    throw new Error("Add at least one diameter.");
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

  const diameterKeys = new Set<number>();
  for (const diameter of diameters) {
    if (diameterKeys.has(diameter.insideDiameterFeet)) {
      throw new Error(
        `Duplicate diameter ${diameter.insideDiameterFeet}' in template.`,
      );
    }
    diameterKeys.add(diameter.insideDiameterFeet);
  }

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
    // Rect structures can be open-bottom / open-top: 0 (or blank) thickness
    // means the template has no such slab. Circular still requires both.
    baseSlabThicknessInches:
      shape === "RECTANGULAR"
        ? requireNonNegativeNumber(
            data.baseSlabThicknessInches ?? 0,
            "Base slab thickness",
          )
        : requirePositiveNumber(
            data.baseSlabThicknessInches,
            "Base slab thickness",
          ),
    topSlabThicknessInches:
      shape === "RECTANGULAR"
        ? requireNonNegativeNumber(
            data.topSlabThicknessInches ?? 0,
            "Top slab thickness",
          )
        : requirePositiveNumber(
            data.topSlabThicknessInches,
            "Top slab thickness",
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
    rectTopSlabPrice:
      shape === "RECTANGULAR"
        ? optionalNonNegativeNumber(data.rectTopSlabPrice)
        : null,
    rectBaseSlabPrice:
      shape === "RECTANGULAR"
        ? optionalNonNegativeNumber(data.rectBaseSlabPrice)
        : null,
    rectPdfSetId: data.rectPdfSetId ? String(data.rectPdfSetId) : null,
    status,
    notes: String(data.notes ?? "").trim() || null,
    diameters,
    rectSizes,
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
    rectPdfSetId: payload.rectPdfSetId,
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

/** A template may only use a Sheet PDF Set of its own shape. */
export async function assertPdfSetMatchesShape(
  payload: TemplatePayload,
): Promise<void> {
  if (!payload.rectPdfSetId) {
    return;
  }
  const set = await prisma.rectSheetPdfSet.findUnique({
    where: { id: payload.rectPdfSetId },
    select: { shape: true, name: true },
  });
  if (!set) {
    throw new Error("The selected Sheet PDF Set no longer exists.");
  }
  if (set.shape !== payload.shape) {
    throw new Error(
      `"${set.name}" is a ${set.shape === "CIRCULAR" ? "circular" : "rectangular"} sheet PDF set and cannot be used on a ${payload.shape === "CIRCULAR" ? "circular" : "rectangular"} template.`,
    );
  }
}
