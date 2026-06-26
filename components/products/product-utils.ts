import type { ProductKind } from "@/app/generated/prisma/client";
import type { StatusVariant } from "@/lib/status-variants";
import {
  bulkPasteExamples,
  getBulkPasteHeaders,
  productKindLabels,
} from "@/lib/product-kinds";

export type { ProductKind };
export { productKindLabels };

export type ProductType =
  | "STOCK"
  | "CONFIGURABLE"
  | "CUSTOM_STRUCTURE"
  | "SERVICE"
  | "MATERIAL";

export type ProductRow = {
  id: string;
  productCode: string;
  productName: string;
  productType: ProductType;
  productTypeLabel: string;
  productTypeVariant: StatusVariant;
  category: string;
  subcategory: string;
  categoryVariant: StatusVariant;
  unit: string;
  defaultPrice: string;
  weight: string;
  yards: string;
  trackInventory: boolean;
  status: string;
  statusVariant: StatusVariant;
  submittalCount: number;
  isCasting?: boolean;
  castingRole?: string;
  productKind?: ProductKind;
  productKindLabel?: string;
};

export const productTypeLabels: Record<ProductType, string> = {
  STOCK: "Stock",
  CONFIGURABLE: "Configurable",
  CUSTOM_STRUCTURE: "Custom Structure",
  SERVICE: "Service",
  MATERIAL: "Material",
};

export const productTypeFilterOptions = [
  "All",
  "Stock",
  "Configurable",
  "Custom Structure",
  "Service",
  "Material",
];

export const productTypeFormOptions: { value: ProductType; label: string }[] = [
  { value: "STOCK", label: "STOCK — Stock" },
  { value: "CONFIGURABLE", label: "CONFIGURABLE — Configurable" },
  { value: "CUSTOM_STRUCTURE", label: "CUSTOM_STRUCTURE — Custom Structure" },
  { value: "SERVICE", label: "SERVICE — Service" },
  { value: "MATERIAL", label: "MATERIAL — Material" },
];

export const productTypeHelperText: Record<ProductType, string> = {
  STOCK:
    "Standard products made the same way each time and kept in inventory.",
  CONFIGURABLE:
    "Reusable product templates that need job-specific cut sheets and openings.",
  CUSTOM_STRUCTURE:
    "Custom job-specific structure templates with their own submittals and cut sheets.",
  SERVICE: "Labor or service items billed without standard inventory tracking.",
  MATERIAL: "Raw materials or supply items used in production or quoting.",
};

export const productCategoryFilterOptions = [
  "All",
  "Vaults",
  "Manholes",
  "Walls",
  "Slabs",
  "Drainage",
  "Accessories",
  "Castings",
  "Pipes",
  "Rings",
];

export const productSubcategoryFilterOptions = [
  "All",
  "Traffic Rated",
  "Standard Duty",
  "Light Duty",
  "Riser",
  "H8 Panel",
  "Catch Basin",
  "Sanitary Sewer",
  "Equipment Pad",
  "Lifting Hardware",
];

export const productStatusFilterOptions = [
  "All",
  "Active",
  "Inactive",
  "Discontinued",
];

export const productInventoryFilterOptions = ["All", "Yes", "No"];

export const productSubmittalsFilterOptions = [
  "All",
  "Has submittals",
  "Missing submittals",
];

export const productCategoryFormOptions = [
  "Vaults",
  "Manholes",
  "Walls",
  "Slabs",
  "Drainage",
  "Accessories",
  "Castings",
  "Pipes",
  "Rings",
];

export const productSubcategoryFormOptions = [
  "Traffic Rated",
  "Standard Duty",
  "Light Duty",
  "Riser",
  "Cone",
  "Base Section",
  "H6 Panel",
  "H8 Panel",
  "Corner Panel",
  "Catch Basin",
  "Sanitary Sewer",
  "Equipment Pad",
  "Sidewalk Slab",
  "Lifting Hardware",
  "Connection Hardware",
];

export const productUnitFormOptions = ["EA", "LF", "SF", "CY", "Ton"];

export const productStatusFormOptions = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DISCONTINUED", label: "Discontinued" },
];

function productTypeVariant(
  productType: ProductType,
): ProductRow["productTypeVariant"] {
  switch (productType) {
    case "STOCK":
      return "success";
    case "CONFIGURABLE":
      return "info";
    case "CUSTOM_STRUCTURE":
      return "warning";
    default:
      return "neutral";
  }
}

export const productInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export type BulkProductPasteRow = {
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

/** @deprecated Use getBulkPasteHeaders(kind) instead */
export const bulkPasteColumnHeaders = getBulkPasteHeaders("DRAIN_RING");

/** @deprecated Use bulkPasteExamples[kind] instead */
export const bulkPasteExample = bulkPasteExamples.DRAIN_RING;
