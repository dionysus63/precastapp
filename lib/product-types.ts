import type { ProductKind, ProductType } from "@/app/generated/prisma/client";

export type { ProductType, ProductKind };

/** Catalog product types shown on the Products tab (physical + admin service/configurable). */
export const CATALOG_PRODUCT_TYPES = [
  "STOCK_PRECAST",
  "CASTING",
  "ACCESSORY",
  "PRECAST_PIPE",
  "ADS_PIPE",
  "CONFIGURABLE",
  "SERVICE",
] as const satisfies readonly ProductType[];

/** Physical SKUs that appear in stock pickers and carry yard inventory. */
export const PHYSICAL_PRODUCT_TYPES = [
  "STOCK_PRECAST",
  "CASTING",
  "ACCESSORY",
  "PRECAST_PIPE",
  "ADS_PIPE",
] as const satisfies readonly ProductType[];

export type PhysicalProductType = (typeof PHYSICAL_PRODUCT_TYPES)[number];

export const productTypeLabels: Record<ProductType, string> = {
  STOCK_PRECAST: "Stock Precast",
  CASTING: "Castings",
  ACCESSORY: "Accessories",
  PRECAST_PIPE: "Precast Pipe",
  ADS_PIPE: "ADS Pipe",
  CONFIGURABLE: "Configurable",
  SERVICE: "Service",
};

export const catalogProductTypeFormOptions: {
  value: ProductType;
  label: string;
}[] = [
  { value: "STOCK_PRECAST", label: "Stock Precast — vaults, manholes, walls, slabs, rings" },
  { value: "CASTING", label: "Castings — assemblies and components" },
  { value: "ACCESSORY", label: "Accessories — filter fabric, hardware, etc." },
  { value: "PRECAST_PIPE", label: "Precast Pipe — RCP and similar" },
  { value: "ADS_PIPE", label: "ADS Pipe — plastic pipe" },
  { value: "CONFIGURABLE", label: "Configurable — reusable structure templates" },
  { value: "SERVICE", label: "Service — labor and fees" },
];

export const productTypeHelperText: Record<ProductType, string> = {
  STOCK_PRECAST:
    "Standard precast structures and rings kept in the yard catalog.",
  CASTING:
    "Cast iron castings sold as assemblies, one-piece units, or component parts.",
  ACCESSORY:
    "Supplies and accessories stocked alongside precast (e.g. filter fabric).",
  PRECAST_PIPE:
    "Reinforced concrete pipe with diameter, length, class, and joint profile.",
  ADS_PIPE:
    "Plastic ADS pipe — diameter and length only; class/joint not applicable.",
  CONFIGURABLE:
    "Reusable templates that need job-specific cut sheets and openings.",
  SERVICE: "Labor or service items billed without yard inventory.",
};

export function isPhysicalProductType(
  productType: ProductType,
): productType is PhysicalProductType {
  return (PHYSICAL_PRODUCT_TYPES as readonly ProductType[]).includes(productType);
}

export function isPipeProductType(productType: ProductType): boolean {
  return productType === "PRECAST_PIPE" || productType === "ADS_PIPE";
}

export function isCastingProductType(productType: ProductType): boolean {
  return productType === "CASTING";
}

export function productKindsForType(productType: ProductType): ProductKind[] {
  switch (productType) {
    case "CASTING":
      return ["CASTING_ASSEMBLY", "CASTING_COMPONENT"];
    case "STOCK_PRECAST":
      return ["STANDARD", "DRAIN_RING"];
    case "ACCESSORY":
    case "PRECAST_PIPE":
    case "ADS_PIPE":
    case "CONFIGURABLE":
    case "SERVICE":
      return ["STANDARD"];
  }
}

export function defaultKindForType(productType: ProductType): ProductKind {
  const kinds = productKindsForType(productType);
  return kinds[0] ?? "STANDARD";
}

export function productTypeForPreset(
  preset: string,
): ProductType {
  switch (preset) {
    case "STOCK_PRECAST":
    case "DRAIN_RING":
      return "STOCK_PRECAST";
    case "ACCESSORY":
      return "ACCESSORY";
    case "PRECAST_PIPE":
      return "PRECAST_PIPE";
    case "ADS_PIPE":
      return "ADS_PIPE";
    case "CASTING_SET_WITH_PARTS":
    case "CASTING_ONE_PIECE":
    case "CASTING_COMPONENT":
      return "CASTING";
    default:
      return "STOCK_PRECAST";
  }
}

export function resolveInventoryForProduct(
  productType: ProductType,
  productKind: ProductKind,
  castingSoldAsUnit: boolean,
  currentStockQuantity: number,
): { trackInventory: boolean; currentStockQuantity: number } {
  if (productType === "SERVICE" || productType === "CONFIGURABLE") {
    return { trackInventory: false, currentStockQuantity: 0 };
  }
  if (productKind === "CASTING_ASSEMBLY" && !castingSoldAsUnit) {
    return { trackInventory: false, currentStockQuantity: 0 };
  }
  return { trackInventory: true, currentStockQuantity };
}
