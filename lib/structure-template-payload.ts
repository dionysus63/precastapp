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
  insideLengthFeet: number;
  insideWidthFeet: number;
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

  // Preset L x W sizes are optional (rect sheets also accept free entry);
  // rows with both fields blank are dropped.
  const rectSizesRaw =
    shape === "RECTANGULAR" && Array.isArray(data.rectSizes)
      ? data.rectSizes
      : [];
  const rectSizes: RectSizePayload[] = [];
  rectSizesRaw.forEach((item, index) => {
    const row = item as Record<string, unknown>;
    const lengthBlank =
      row.insideLengthFeet === "" || row.insideLengthFeet == null;
    const widthBlank =
      row.insideWidthFeet === "" || row.insideWidthFeet == null;
    if (lengthBlank && widthBlank) {
      return;
    }
    rectSizes.push({
      insideLengthFeet: requirePositiveNumber(
        row.insideLengthFeet,
        `Preset size #${index + 1} inside length`,
      ),
      insideWidthFeet: requirePositiveNumber(
        row.insideWidthFeet,
        `Preset size #${index + 1} inside width`,
      ),
    });
  });

  const rectSizeKeys = new Set<string>();
  for (const size of rectSizes) {
    const key = `${size.insideLengthFeet}x${size.insideWidthFeet}`;
    if (rectSizeKeys.has(key)) {
      throw new Error(
        `Duplicate preset size ${size.insideLengthFeet}' x ${size.insideWidthFeet}' in template.`,
      );
    }
    rectSizeKeys.add(key);
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
    rectWallPricePerFoot:
      payload.rectWallPricePerFoot === null
        ? null
        : decimal(payload.rectWallPricePerFoot),
    rectMinPricingHeightFeet:
      payload.rectMinPricingHeightFeet === null
        ? null
        : decimal(payload.rectMinPricingHeightFeet),
    rectTopSlabPrice:
      payload.rectTopSlabPrice === null
        ? null
        : decimal(payload.rectTopSlabPrice),
    rectBaseSlabPrice:
      payload.rectBaseSlabPrice === null
        ? null
        : decimal(payload.rectBaseSlabPrice),
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
        insideLengthFeet: decimal(size.insideLengthFeet),
        insideWidthFeet: decimal(size.insideWidthFeet),
        sortOrder: index,
      })),
    },
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
