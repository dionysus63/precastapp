import type {
  CastingPieceRole,
  CastingRole,
  DrainRingStyle,
  ProductKind,
} from "@/app/generated/prisma/client";
import {
  assertSanitaryDrainRingAllowed,
  diameterSupportsSanitaryDrainRing,
  formatSanitaryDrainRingDiametersLabel,
  isRecognizedBulkRingStyle,
  parseBulkRingStyle,
  parseDrainRingStyle,
} from "@/lib/drain-ring-utils";
import { parseCastingPieceRole } from "@/lib/casting-utils";

export type { ProductKind };

export const PRODUCT_KINDS = [
  "STANDARD",
  "DRAIN_RING",
  "CASTING_ASSEMBLY",
  "CASTING_COMPONENT",
  "PIPE",
] as const satisfies readonly ProductKind[];

export const productKindLabels: Record<ProductKind, string> = {
  STANDARD: "Standard",
  DRAIN_RING: "Drain Ring",
  CASTING_ASSEMBLY: "Casting Assembly",
  CASTING_COMPONENT: "Casting Component",
  PIPE: "Pipe",
};

export const productKindFormOptions: { value: ProductKind; label: string }[] = [
  { value: "STANDARD", label: "Standard — generic stock SKU" },
  { value: "DRAIN_RING", label: "Drain Ring — pool ring stocked by diameter & height" },
  {
    value: "CASTING_ASSEMBLY",
    label: "Casting Assembly — full casting with BOM",
  },
  {
    value: "CASTING_COMPONENT",
    label: "Casting Component — frame, cover/grate, hood, or throat piece",
  },
  { value: "PIPE", label: "Pipe — precast pipe stock SKU" },
];

export const bulkImportKinds: ProductKind[] = [
  "STANDARD",
  "DRAIN_RING",
  "PIPE",
  "CASTING_COMPONENT",
  "CASTING_ASSEMBLY",
];

export const bulkPasteBaseHeaders = [
  "Product Code",
  "Product Name",
  "Category",
  "Subcategory",
  "Unit",
  "Default Price",
  "Weight",
  "Yards",
  "Track Inventory",
] as const;

export const bulkPasteCastingBaseHeaders = [
  "Product Code",
  "Product Name",
  "Category",
  "Subcategory",
  "Unit",
  "Default Price",
  "Weight",
  "Supplier",
  "Track Inventory",
] as const;

const bulkKindExtraHeaders: Record<ProductKind, readonly string[]> = {
  STANDARD: [],
  DRAIN_RING: [
    "Ring Diameter (ft)",
    "Ring Height (ft)",
    "Style (DRAIN/SAN/SOL)",
  ],
  PIPE: [
    "Pipe Diameter (in)",
    "Pipe Length (ft)",
    "Class",
    "Joint Type",
  ],
  CASTING_COMPONENT: ["Piece Role (FRAME/COVER_GRATE/HOOD/THROAT)"],
  CASTING_ASSEMBLY: [
    "Casting Height (ft)",
    "Clear Opening (in)",
    "Frame Code",
    "Cover/Grate Code",
    "Hood Code",
    "Throat Code",
  ],
};

export function usesCastingBulkPasteBaseHeaders(kind: ProductKind): boolean {
  return kind === "CASTING_COMPONENT" || kind === "CASTING_ASSEMBLY";
}

export function getBulkPasteBaseHeaders(kind: ProductKind): readonly string[] {
  return usesCastingBulkPasteBaseHeaders(kind)
    ? bulkPasteCastingBaseHeaders
    : bulkPasteBaseHeaders;
}

export function getBulkPasteHeaders(kind: ProductKind): string[] {
  return [...getBulkPasteBaseHeaders(kind), ...bulkKindExtraHeaders[kind]];
}

export const bulkPasteExamples: Record<ProductKind, string> = {
  STANDARD: `VLT-60x84\t60x84 Utility Vault\tVaults\tTraffic Rated\tEach\t6200.00\t10200 lb\t3.1\tYes
MH-48-R\t48" Manhole Riser\tManholes\tRiser\tEach\t980.00\t1650 lb\t0.5\tYes`,
  DRAIN_RING: `R-10-4-DRAIN\t10' Ring 4' tall\tRings\t10' dia\tEach\t850.00\t4200 lb\t0.8\tYes\t10\t4\tDRAIN
R-10-4-SAN\t10' Ring 4' sanitary\tRings\t10' dia\tEach\t920.00\t4300 lb\t0.8\tYes\t10\t4\tSAN
R-8-2.5-SAN\t8' Ring 2.5' sanitary\tRings\t8' dia\tEach\t680.00\t2200 lb\t0.4\tYes\t8\t2.5\tSAN`,
  PIPE: `RCP-24-8\t24" RCP 8' Class III\tPipes\t24" dia\tEach\t420.00\t2800 lb\t0.2\tYes\t24\t8\tIII\tRCP
RCP-36-8\t36" RCP 8' Class IV\tPipes\t36" dia\tEach\t680.00\t4200 lb\t0.3\tYes\t36\t8\tIV\tRCP`,
  CASTING_ASSEMBLY: `CA-24-STD\t24" Standard Casting Assembly\tCastings\tStandard\tEach\t420.00\t180 lb\tNeenah Foundry\tNo\t0.67\t24\tCF-FRM-24\tCF-CVR-24`,
  CASTING_COMPONENT: `CF-FRM-24\t24" Casting Frame\tCastings\tFrame\tEach\t180.00\t95 lb\tNeenah Foundry\tYes\tFRAME
CF-CGR-24\t24" Casting Cover/Grate\tCastings\tCover/Grate\tEach\t120.00\t65 lb\tNeenah Foundry\tYes\tCOVER_GRATE`,
};

export type BulkPasteRowBase = {
  lineNumber: number;
  productCode: string;
  productName: string;
  category: string;
  subcategory: string;
  unit: string;
  defaultPrice: string;
  weight: string;
  yards: string;
  supplier: string;
  trackInventory: string;
  kindFields: Record<string, string>;
  isValid: boolean;
  issues: string[];
};

export function parseProductKind(value: string): ProductKind | null {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (PRODUCT_KINDS.includes(normalized as ProductKind)) {
    return normalized as ProductKind;
  }
  return null;
}

export function legacyFlagsToProductKind(
  isDrainRing: boolean,
  castingRole: CastingRole | null | undefined,
): ProductKind {
  if (isDrainRing) {
    return "DRAIN_RING";
  }
  if (castingRole === "ASSEMBLY") {
    return "CASTING_ASSEMBLY";
  }
  if (castingRole === "COMPONENT") {
    return "CASTING_COMPONENT";
  }
  return "STANDARD";
}

export function productKindToLegacyFlags(kind: ProductKind): {
  isDrainRing: boolean;
  isCasting: boolean;
  castingRole: CastingRole | null;
} {
  switch (kind) {
    case "DRAIN_RING":
      return {
        isDrainRing: true,
        isCasting: false,
        castingRole: null,
      };
    case "CASTING_ASSEMBLY":
      return {
        isDrainRing: false,
        isCasting: true,
        castingRole: "ASSEMBLY",
      };
    case "CASTING_COMPONENT":
      return {
        isDrainRing: false,
        isCasting: false,
        castingRole: "COMPONENT",
      };
    default:
      return {
        isDrainRing: false,
        isCasting: false,
        castingRole: null,
      };
  }
}

export function suggestedKindForCategory(category: string): ProductKind | null {
  switch (category) {
    case "Castings":
      return "CASTING_ASSEMBLY";
    case "Rings":
      return "DRAIN_RING";
    case "Pipes":
      return "PIPE";
    default:
      return null;
  }
}

export function resolveInventorySettings(
  kind: ProductKind,
  trackInventory: boolean,
  currentStockQuantity: number,
): { trackInventory: boolean; currentStockQuantity: number } {
  if (kind === "CASTING_ASSEMBLY") {
    return { trackInventory: false, currentStockQuantity: 0 };
  }
  if (kind === "CASTING_COMPONENT") {
    return { trackInventory: true, currentStockQuantity };
  }
  // PIPE and STANDARD use normal inventory tracking — no special fulfillment branch.
  return { trackInventory, currentStockQuantity };
}

function parseYesNoInventory(value: string): {
  trackInventory: boolean;
  error?: string;
} {
  const inventoryValue = value.trim().toLowerCase();
  if (inventoryValue && inventoryValue !== "yes" && inventoryValue !== "no") {
    return {
      trackInventory: true,
      error: 'Track inventory must be "Yes" or "No".',
    };
  }
  return { trackInventory: inventoryValue !== "no" };
}

function parsePositiveNumber(
  raw: string,
  label: string,
): { value: number | null; error?: string } {
  const cleaned = raw.replace(/[$,]/g, "").replace(/[^\d.]/g, "").trim();
  if (!cleaned) {
    return { value: null, error: `${label} is required.` };
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) {
    return { value: null, error: `${label} must be a positive number.` };
  }
  return { value };
}

function linePrefix(lineNumber: number | undefined): string {
  return lineNumber ? `Line ${lineNumber}` : "Product";
}

export function validateBulkPasteRow(
  kind: ProductKind,
  row: {
    productCode: string;
    productName: string;
    trackInventory: string;
    supplier?: string;
    kindFields: Record<string, string>;
  },
  lineNumber?: number,
): string[] {
  const issues: string[] = [];
  const prefix = linePrefix(lineNumber);

  if (!row.productCode.trim()) {
    issues.push("Product code is required.");
  }
  if (!row.productName.trim()) {
    issues.push("Product name is required.");
  }

  const inventory = parseYesNoInventory(row.trackInventory);
  if (inventory.error) {
    issues.push(inventory.error);
  }

  if (kind === "DRAIN_RING") {
    const diameter = parsePositiveNumber(
      row.kindFields.ringDiameterFeet ?? "",
      "Pool diameter (ft)",
    );
    const height = parsePositiveNumber(
      row.kindFields.heightFeet ?? "",
      "Ring height (ft)",
    );
    if (diameter.error) {
      issues.push(diameter.error);
    }
    if (height.error) {
      issues.push(height.error);
    }

    const ringStyle = row.kindFields.ringStyle ?? "";
    if (ringStyle.trim() && !isRecognizedBulkRingStyle(ringStyle)) {
      issues.push('Style must be "DRAIN", "SAN", "SOL", or legacy "Yes"/"No".');
    }

    if (diameter.value != null) {
      const style = parseBulkRingStyle(ringStyle);
      if (
        style === "SANITARY" &&
        !diameterSupportsSanitaryDrainRing(diameter.value)
      ) {
        issues.push(
          `${prefix}: sanitary rings are only available for ${formatSanitaryDrainRingDiametersLabel()} diameters.`,
        );
      }
    }
  }

  if (kind === "PIPE") {
    const diameter = parsePositiveNumber(
      row.kindFields.pipeDiameterInches ?? "",
      "Pipe diameter (in)",
    );
    const length = parsePositiveNumber(
      row.kindFields.pipeLengthFeet ?? "",
      "Pipe length (ft)",
    );
    if (diameter.error) {
      issues.push(diameter.error);
    }
    if (length.error) {
      issues.push(length.error);
    }
  }

  if (kind === "CASTING_COMPONENT") {
    if (!row.supplier?.trim()) {
      issues.push("Supplier is required.");
    }
    const pieceRole = parseCastingPieceRole(
      row.kindFields.castingPieceRole ?? "",
    );
    if (!pieceRole) {
      issues.push('Piece role must be "FRAME", "COVER_GRATE", "HOOD", or "THROAT".');
    }
  }

  if (kind === "CASTING_ASSEMBLY") {
    if (!row.supplier?.trim()) {
      issues.push("Supplier is required.");
    }
    const height = parsePositiveNumber(
      row.kindFields.castingHeightFeet ?? "",
      "Casting height (ft)",
    );
    if (height.error) {
      issues.push(height.error);
    }
    if (!row.kindFields.frameProductCode?.trim()) {
      issues.push("Frame code is required.");
    }
    if (!row.kindFields.coverGrateProductCode?.trim()) {
      issues.push("Cover/Grate code is required.");
    }
  }

  return issues;
}

export type ParsedProductProfile = {
  heightFeet: string | null;
  ringDiameterFeet: string | null;
  drainRingStyle: DrainRingStyle;
  castingClearOpeningInches: string | null;
  castingRole: CastingRole | null;
  castingPieceRole: CastingPieceRole | null;
  castingSupplierId: string | null;
  pipeDiameterInches: string | null;
  pipeLengthFeet: string | null;
  pipeClass: string | null;
  pipeJointType: string | null;
};

export type ProfileFieldReader = {
  getString(field: string): string;
  getDecimal(field: string, label: string): string | null;
};

export function parseAndValidateProductProfile(
  kind: ProductKind,
  reader: ProfileFieldReader,
  context = "Product",
): ParsedProductProfile {
  const empty: ParsedProductProfile = {
    heightFeet: null,
    ringDiameterFeet: null,
    drainRingStyle: "DRAIN",
    castingClearOpeningInches: null,
    castingRole: null,
    castingPieceRole: null,
    castingSupplierId: null,
    pipeDiameterInches: null,
    pipeLengthFeet: null,
    pipeClass: null,
    pipeJointType: null,
  };

  switch (kind) {
    case "DRAIN_RING": {
      const heightFeet = reader.getDecimal("heightFeet", "Ring height");
      const ringDiameterFeet = reader.getDecimal(
        "ringDiameterFeet",
        "Pool diameter",
      );
      if (!heightFeet || !ringDiameterFeet) {
        throw new Error(
          `${context}: rings require both a ring height and a pool diameter.`,
        );
      }
      const drainRingStyle = parseDrainRingStyle(
        reader.getString("drainRingStyle") || "DRAIN",
      );
      assertSanitaryDrainRingAllowed(
        Number(ringDiameterFeet),
        drainRingStyle,
        context,
      );
      return {
        ...empty,
        heightFeet,
        ringDiameterFeet,
        drainRingStyle,
      };
    }
    case "CASTING_ASSEMBLY": {
      const heightFeet = reader.getDecimal("castingHeightFeet", "Casting height");
      if (!heightFeet) {
        throw new Error(`${context}: casting assemblies require a casting height.`);
      }
      return {
        ...empty,
        heightFeet,
        castingClearOpeningInches: reader.getDecimal(
          "castingClearOpeningInches",
          "Clear opening",
        ),
        castingRole: "ASSEMBLY",
        castingSupplierId: reader.getString("castingSupplierId") || null,
      };
    }
    case "CASTING_COMPONENT": {
      const castingPieceRole = parseCastingPieceRole(
        reader.getString("castingPieceRole"),
      );
      if (!castingPieceRole) {
        throw new Error(
          `${context}: casting components require a piece role (frame, cover, or grate).`,
        );
      }
      return {
        ...empty,
        castingRole: "COMPONENT",
        castingPieceRole,
        castingSupplierId: reader.getString("castingSupplierId") || null,
      };
    }
    case "PIPE": {
      const pipeDiameterInches = reader.getDecimal(
        "pipeDiameterInches",
        "Pipe diameter",
      );
      const pipeLengthFeet = reader.getDecimal("pipeLengthFeet", "Pipe length");
      if (!pipeDiameterInches || !pipeLengthFeet) {
        throw new Error(
          `${context}: pipe products require both diameter and length.`,
        );
      }
      return {
        ...empty,
        pipeDiameterInches,
        pipeLengthFeet,
        pipeClass: reader.getString("pipeClass") || null,
        pipeJointType: reader.getString("pipeJointType") || null,
      };
    }
    default:
      return empty;
  }
}

export function formatProductKindBadgeLabel(kind: ProductKind): string | null {
  if (kind === "STANDARD") {
    return null;
  }
  return productKindLabels[kind];
}

export function productKindBadgeVariant(
  kind: ProductKind,
): "info" | "success" | "warning" | "neutral" {
  switch (kind) {
    case "DRAIN_RING":
      return "success";
    case "CASTING_ASSEMBLY":
    case "CASTING_COMPONENT":
      return "info";
    case "PIPE":
      return "warning";
    default:
      return "neutral";
  }
}
