import type {
  CastingPieceRole,
  CastingRole,
  DrainRingStyle,
  ProductKind,
  ProductType,
} from "@/app/generated/prisma/client";
import { productTypeForPreset } from "@/lib/product-types";
import {
  parseAdsPipeJointType,
} from "@/lib/ads-pipe-utils";
import { RCP_PIPE_JOINT_TYPE } from "@/lib/rcp-pipe-utils";
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
] as const satisfies readonly ProductKind[];

export const productKindLabels: Record<ProductKind, string> = {
  STANDARD: "Standard",
  DRAIN_RING: "Drain Ring",
  CASTING_ASSEMBLY: "Casting Assembly",
  CASTING_COMPONENT: "Casting Component",
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
    label: "Casting Component — frame, cover/grate, or hood piece",
  },
];

export type BulkImportPreset =
  | "STOCK_PRECAST"
  | "ACCESSORY"
  | "DRAIN_RING"
  | "PRECAST_PIPE"
  | "ADS_PIPE"
  | "CASTING_SET_WITH_PARTS"
  | "CASTING_ONE_PIECE"
  | "CASTING_COMPONENT";

export const bulkImportPresets: BulkImportPreset[] = [
  "STOCK_PRECAST",
  "ACCESSORY",
  "DRAIN_RING",
  "PRECAST_PIPE",
  "ADS_PIPE",
  "CASTING_SET_WITH_PARTS",
  "CASTING_ONE_PIECE",
  "CASTING_COMPONENT",
];

export const bulkImportPresetLabels: Record<BulkImportPreset, string> = {
  STOCK_PRECAST: "Stock precast — vaults, manholes, walls, slabs",
  ACCESSORY: "Accessory — filter fabric, hardware, etc.",
  DRAIN_RING: "Drain ring — diameter, height, and style",
  PRECAST_PIPE: "Precast pipe — RCP with class (O-Ring joint)",
  ADS_PIPE: "ADS pipe — plastic with watertight or soiltight joint",
  CASTING_SET_WITH_PARTS: "Casting set with parts — BOM assembly",
  CASTING_ONE_PIECE: "Casting one-piece unit — no BOM",
  CASTING_COMPONENT: "Casting component — frame, cover, or hood",
};

export function presetToProductType(preset: BulkImportPreset): ProductType {
  return productTypeForPreset(preset);
}

export function presetToProductKind(preset: BulkImportPreset): ProductKind {
  switch (preset) {
    case "DRAIN_RING":
      return "DRAIN_RING";
    case "CASTING_SET_WITH_PARTS":
    case "CASTING_ONE_PIECE":
      return "CASTING_ASSEMBLY";
    case "CASTING_COMPONENT":
      return "CASTING_COMPONENT";
    default:
      return "STANDARD";
  }
}

export function presetRequiresSupplier(preset: BulkImportPreset): boolean {
  return (
    preset === "CASTING_SET_WITH_PARTS" ||
    preset === "CASTING_ONE_PIECE" ||
    preset === "CASTING_COMPONENT"
  );
}

export function presetCastingSoldAsUnit(preset: BulkImportPreset): boolean {
  return preset === "CASTING_ONE_PIECE";
}

const bulkPasteTaxonomyHeaders = ["Category", "Subcategory"] as const;

function withBulkPasteTaxonomy(headers: readonly string[]): string[] {
  return [
    headers[0],
    headers[1],
    ...bulkPasteTaxonomyHeaders,
    ...headers.slice(2),
  ];
}

function withBulkPasteTaxonomyKeys(keys: readonly string[]): string[] {
  return [keys[0], keys[1], "category", "subcategory", ...keys.slice(2)];
}

const bulkPasteSixColHeaders = [
  "Product Code",
  "Product Name",
  "Unit",
  "Unit Price",
  "Weight",
  "Yards",
] as const;

const bulkPasteCastingComponentBaseHeaders = [
  "Product Code",
  "Product Name",
  "Unit",
  "Unit Price",
  "Weight",
  "Piece Role (FRAME/COVER_GRATE/HOOD)",
] as const;

const bulkPasteCastingOnePieceBaseHeaders = [
  "Product Code",
  "Product Name",
  "Unit",
  "Unit Price",
  "Weight",
  "Height (ft)",
] as const;

const bulkPasteCastingSetBaseHeaders = [
  "Product Code",
  "Product Name",
  "Unit",
  "Unit Price",
  "Weight",
  "Height (ft)",
  "Manufacturer Code",
  "Frame Code",
  "Cover/Grate Code",
  "Hood Code",
] as const;

const bulkPasteDrainRingBaseHeaders = [
  "Product Code",
  "Product Name",
  "Unit",
  "Unit Price",
  "Weight",
  "Yards",
  "Ring Diameter (ft)",
  "Ring Height (ft)",
  "Style (DRAIN/SAN/SOL)",
] as const;

const bulkPastePrecastPipeBaseHeaders = [
  "Product Code",
  "Product Name",
  "Unit",
  "Unit Price",
  "Weight",
  "Pipe Diameter (in)",
  "Pipe Length (ft)",
  "Class",
] as const;

const bulkPasteAdsPipeBaseHeaders = [
  "Product Code",
  "Product Name",
  "Unit",
  "Unit Price",
  "Weight",
  "Pipe Diameter (in)",
  "Pipe Length (ft)",
  "Joint Type (WT/ST)",
] as const;

export function getBulkPasteHeaders(preset: BulkImportPreset): string[] {
  switch (preset) {
    case "STOCK_PRECAST":
    case "ACCESSORY":
      return withBulkPasteTaxonomy(bulkPasteSixColHeaders);
    case "DRAIN_RING":
      return withBulkPasteTaxonomy(bulkPasteDrainRingBaseHeaders);
    case "PRECAST_PIPE":
      return withBulkPasteTaxonomy(bulkPastePrecastPipeBaseHeaders);
    case "ADS_PIPE":
      return withBulkPasteTaxonomy(bulkPasteAdsPipeBaseHeaders);
    case "CASTING_SET_WITH_PARTS":
      return withBulkPasteTaxonomy(bulkPasteCastingSetBaseHeaders);
    case "CASTING_ONE_PIECE":
      return withBulkPasteTaxonomy(bulkPasteCastingOnePieceBaseHeaders);
    case "CASTING_COMPONENT":
      return withBulkPasteTaxonomy(bulkPasteCastingComponentBaseHeaders);
  }
}

export function getBulkPasteFieldKeys(preset: BulkImportPreset): string[] {
  switch (preset) {
    case "STOCK_PRECAST":
    case "ACCESSORY":
      return withBulkPasteTaxonomyKeys([
        "productCode",
        "productName",
        "unit",
        "unitPrice",
        "weight",
        "yards",
      ]);
    case "DRAIN_RING":
      return withBulkPasteTaxonomyKeys([
        "productCode",
        "productName",
        "unit",
        "unitPrice",
        "weight",
        "yards",
        "ringDiameterFeet",
        "heightFeet",
        "ringStyle",
      ]);
    case "PRECAST_PIPE":
      return withBulkPasteTaxonomyKeys([
        "productCode",
        "productName",
        "unit",
        "unitPrice",
        "weight",
        "pipeDiameterInches",
        "pipeLengthFeet",
        "pipeClass",
      ]);
    case "ADS_PIPE":
      return withBulkPasteTaxonomyKeys([
        "productCode",
        "productName",
        "unit",
        "unitPrice",
        "weight",
        "pipeDiameterInches",
        "pipeLengthFeet",
        "pipeJointType",
      ]);
    case "CASTING_SET_WITH_PARTS":
      return withBulkPasteTaxonomyKeys([
        "productCode",
        "productName",
        "unit",
        "unitPrice",
        "weight",
        "castingHeightFeet",
        "manufacturerCode",
        "frameProductCode",
        "coverGrateProductCode",
        "hoodProductCode",
      ]);
    case "CASTING_ONE_PIECE":
      return withBulkPasteTaxonomyKeys([
        "productCode",
        "productName",
        "unit",
        "unitPrice",
        "weight",
        "castingHeightFeet",
      ]);
    case "CASTING_COMPONENT":
      return withBulkPasteTaxonomyKeys([
        "productCode",
        "productName",
        "unit",
        "unitPrice",
        "weight",
        "castingPieceRole",
      ]);
  }
}

/** Normalize casting-set paste rows: pad trailing optional columns; only insert Manufacturer Code for short legacy rows. */
export function normalizeBulkPasteCells(
  preset: BulkImportPreset,
  cells: string[],
): string[] {
  const expectedColumns = getBulkPasteFieldKeys(preset).length;
  if (preset !== "CASTING_SET_WITH_PARTS") {
    return cells;
  }

  const normalized = [...cells];
  const minimumColumns = 9;

  // Only rows with ≤10 columns use the pre-manufacturer layout (Frame starts
  // at index 8). Rows with 11+ columns already have Manufacturer Code at index 8
  // — pad the trailing Hood tab only; do not insert a blank column.
  if (
    normalized.length >= minimumColumns &&
    normalized.length <= 10 &&
    normalized.length < expectedColumns
  ) {
    normalized.splice(8, 0, "");
  }

  while (normalized.length < expectedColumns) {
    normalized.push("");
  }

  return normalized.slice(0, expectedColumns);
}

export function bulkPasteColumnCountIssue(
  preset: BulkImportPreset,
  cells: string[],
): string | null {
  const expectedColumns = getBulkPasteFieldKeys(preset).length;
  const normalized = normalizeBulkPasteCells(preset, cells);

  if (normalized.length >= expectedColumns) {
    return null;
  }

  if (preset === "CASTING_SET_WITH_PARTS") {
    return `Row has ${cells.length} column${cells.length === 1 ? "" : "s"} but needs at least 9 (through Height plus Frame and Cover/Grate codes). Use tab-separated values; optional Subcategory, Manufacturer Code, Hood, Unit Price, and Weight can be left blank.`;
  }

  return `Expected ${expectedColumns} tab-separated columns for ${bulkImportPresetLabels[preset]}.`;
}

export const bulkPasteExamples: Record<BulkImportPreset, string> = {
  STOCK_PRECAST: `VLT-60x84\t60x84 Utility Vault\tVaults\tTraffic Rated\tEach\t6200.00\t10200 lb\t3.1
MH-48-R\t48" Manhole Riser\tManholes\tRiser\tEach\t980.00\t1650 lb\t0.5`,
  ACCESSORY: `FF-12\t12' Filter Fabric Roll\tAccessories\t\tLF\t4.50\t12 lb\t0
LIFT-1T\t1 Ton Lifting Anchor\tAccessories\t\tEach\t85.00\t18 lb\t0`,
  DRAIN_RING: `R-10-4-DRAIN\t10' Ring 4' tall\tRings\t\tEach\t850.00\t4200 lb\t0.8\t10\t4\tDRAIN
R-10-4-SAN\t10' Ring 4' sanitary\tRings\t\tEach\t920.00\t4300 lb\t0.8\t10\t4\tSAN`,
  PRECAST_PIPE: `RCP-24-8\t24" RCP 8' Class III\tPipes\t\tLF\t52.50\t2800 lb\t24\t8\tIII
RCP-36-8\t36" RCP 8' Class IV\tPipes\t\tLF\t85.00\t4200 lb\t36\t8\tIV`,
  ADS_PIPE: `ADS-12-20-ST\t12" ADS 20' Soiltight\tADS Pipe\t\tLF\t9.25\t95 lb\t12\t20\tST
ADS-12-20-WT\t12" ADS 20' Watertight\tADS Pipe\t\tLF\t10.50\t95 lb\t12\t20\tWT`,
  CASTING_SET_WITH_PARTS: `CA-24-STD\t24" Standard Casting Assembly\tCastings\t\tEach\t420.00\t180 lb\t0.67\tV-1420\tCF-FRM-24\tCF-CGR-24\t
CA-30-HOOD\t30" Casting with Hood\tCastings\t\tEach\t\t\t0.75\t\tCF-FRM-30\tCF-CGR-30\tCF-HOOD-30`,
  CASTING_ONE_PIECE: `CA-24-UNIT\t24" One-Piece Casting\tCastings\t\tEach\t380.00\t175 lb\t0.67
CA-30-UNIT\t30" One-Piece Casting\tCastings\t\tEach\t420.00\t195 lb\t0.75`,
  CASTING_COMPONENT: `CF-FRM-24\t24" Casting Frame\tCastings\t\tEach\t180.00\t95 lb\tFRAME
CF-CGR-24\t24" Casting Cover/Grate\tCastings\t\tEach\t120.00\t65 lb\tCOVER_GRATE`,
};

/** @deprecated Use bulk import presets instead */
export const bulkPasteBaseHeaders = [
  "Product Code",
  "Product Name",
  "Unit",
  "Unit Price",
  "Weight",
  "Yards",
  "Track Inventory",
] as const;

/** @deprecated Use bulk import presets instead */
export const bulkPasteCastingBaseHeaders = [
  "Product Code",
  "Product Name",
  "Unit",
  "Unit Price",
  "Weight",
] as const;

/** @deprecated Use bulk import presets instead */
export function usesCastingBulkPasteBaseHeaders(_kind: ProductKind): boolean {
  return false;
}

/** @deprecated Use getBulkPasteHeaders(preset) instead */
export function getBulkPasteBaseHeaders(_kind: ProductKind): readonly string[] {
  return bulkPasteBaseHeaders;
}

export type BulkPasteRowBase = {
  lineNumber: number;
  productCode: string;
  productName: string;
  unit: string;
  unitPrice: string;
  weight: string;
  yards: string;
  trackInventory: string;
  kindFields: Record<string, string>;
  isValid: boolean;
  issues: string[];
};

export function parseBulkImportPreset(value: string): BulkImportPreset | null {
  const normalized = value.trim().toUpperCase();
  return bulkImportPresets.includes(normalized as BulkImportPreset)
    ? (normalized as BulkImportPreset)
    : null;
}

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

export function resolveInventorySettings(
  productType: ProductType,
  kind: ProductKind,
  currentStockQuantity: number,
  castingSoldAsUnit = false,
): { trackInventory: boolean; currentStockQuantity: number } {
  if (productType === "SERVICE" || productType === "CONFIGURABLE") {
    return { trackInventory: false, currentStockQuantity: 0 };
  }
  if (kind === "CASTING_ASSEMBLY" && !castingSoldAsUnit) {
    return { trackInventory: false, currentStockQuantity: 0 };
  }
  return { trackInventory: true, currentStockQuantity };
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
  preset: BulkImportPreset,
  row: {
    productCode: string;
    productName: string;
    category: string;
    subcategory?: string;
    unitPrice?: string;
    weight?: string;
    trackInventory: string;
    kindFields: Record<string, string>;
  },
  lineNumber?: number,
): string[] {
  const kind = presetToProductKind(preset);
  const issues: string[] = [];
  const prefix = linePrefix(lineNumber);

  if (!row.productCode.trim()) {
    issues.push("Product code is required.");
  }
  if (!row.productName.trim()) {
    issues.push("Product name is required.");
  }
  if (!row.category.trim()) {
    issues.push("Category is required.");
  }

  const productType = presetToProductType(preset);

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

  if (productType === "PRECAST_PIPE" || productType === "ADS_PIPE") {
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

  if (productType === "ADS_PIPE") {
    const jointType = parseAdsPipeJointType(row.kindFields.pipeJointType ?? "");
    if (!jointType) {
      issues.push('Joint type must be "WT" or "ST".');
    }
  }

  if (kind === "CASTING_COMPONENT") {
    const pieceRole = parseCastingPieceRole(
      row.kindFields.castingPieceRole ?? "",
    );
    if (!pieceRole) {
      issues.push('Piece role must be "FRAME", "COVER_GRATE", or "HOOD".');
    }
  }

  if (kind === "CASTING_ASSEMBLY") {
    const height = parsePositiveNumber(
      row.kindFields.castingHeightFeet ?? "",
      "Casting height (ft)",
    );
    if (height.error) {
      issues.push(height.error);
    }
    const isUnit = presetCastingSoldAsUnit(preset);
    if (!isUnit) {
      if (!row.kindFields.frameProductCode?.trim()) {
        issues.push("Frame code is required (unless sold as unit).");
      }
      if (!row.kindFields.coverGrateProductCode?.trim()) {
        issues.push("Cover/Grate code is required (unless sold as unit).");
      }
      const weightRaw = row.weight?.trim() ?? "";
      if (weightRaw) {
        const weight = parsePositiveNumber(weightRaw, "Weight");
        if (weight.error) {
          issues.push(weight.error);
        }
      }
    }
  }

  return issues;
}

export type ParsedProductProfile = {
  heightFeet: string | null;
  ringDiameterFeet: string | null;
  drainRingStyle: DrainRingStyle;
  castingRole: CastingRole | null;
  castingPieceRole: CastingPieceRole | null;
  castingSupplierId: string | null;
  castingSoldAsUnit: boolean;
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
  productType?: ProductType,
): ParsedProductProfile {
  const empty: ParsedProductProfile = {
    heightFeet: null,
    ringDiameterFeet: null,
    drainRingStyle: "DRAIN",
    castingRole: null,
    castingPieceRole: null,
    castingSupplierId: null,
    castingSoldAsUnit: false,
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
      const soldAsUnit =
        reader.getString("castingSoldAsUnit").toLowerCase() === "yes";
      return {
        ...empty,
        heightFeet,
        castingRole: "ASSEMBLY",
        castingSupplierId: reader.getString("castingSupplierId") || null,
        castingSoldAsUnit: soldAsUnit,
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
    default: {
      if (productType === "PRECAST_PIPE") {
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
          pipeJointType: RCP_PIPE_JOINT_TYPE,
        };
      }
      if (productType === "ADS_PIPE") {
        const pipeDiameterInches = reader.getDecimal(
          "pipeDiameterInches",
          "Pipe diameter",
        );
        const pipeLengthFeet = reader.getDecimal("pipeLengthFeet", "Pipe length");
        if (!pipeDiameterInches || !pipeLengthFeet) {
          throw new Error(
            `${context}: ADS pipe products require both diameter and length.`,
          );
        }
        const jointType = parseAdsPipeJointType(reader.getString("pipeJointType"));
        if (!jointType) {
          throw new Error(
            `${context}: ADS pipe requires joint type WT or ST.`,
          );
        }
        return {
          ...empty,
          pipeDiameterInches,
          pipeLengthFeet,
          pipeJointType: jointType,
        };
      }
      return empty;
    }
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
    default:
      return "neutral";
  }
}
