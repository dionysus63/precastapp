import type { ProductKind, ProductType } from "@/app/generated/prisma/client";
import type { StatusVariant } from "@/lib/status-variants";
import {
  bulkPasteExamples,
  getBulkPasteHeaders,
  productKindLabels,
} from "@/lib/product-kinds";
import {
  CATALOG_PRODUCT_TYPES,
  catalogProductTypeFormOptions,
  productTypeHelperText,
  productTypeLabels,
} from "@/lib/product-types";

export type { ProductKind, ProductType };
export {
  CATALOG_PRODUCT_TYPES,
  catalogProductTypeFormOptions as productTypeFormOptions,
  productTypeHelperText,
  productTypeLabels,
  productKindLabels,
};

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
  unitPrice: string;
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
  castingOrigin?: string | null;
  castingSoldAsUnit?: boolean;
};

export const productTypeFilterOptions = [
  "All",
  ...CATALOG_PRODUCT_TYPES.map((type) => productTypeLabels[type]),
];

export const productStatusFilterOptions = [
  "All",
  "Active",
  "Inactive",
  "Discontinued",
];

export const productSubmittalsFilterOptions = [
  "All",
  "Has submittals",
  "Missing submittals",
];

export const productCastingOriginFilterOptions = [
  "All",
  "Domestic",
  "Imported",
] as const;

export const productUnitFormOptions = ["EA", "LF", "SF", "CY", "Ton"];

export const productStatusFormOptions = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DISCONTINUED", label: "Discontinued" },
];

export const productInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export type BulkProductPasteRow = {
  lineNumber: number;
  productCode: string;
  productName: string;
  category: string;
  subcategory: string;
  unit: string;
  unitPrice: string;
  weight: string;
  yards: string;
  trackInventory: string;
  kindFields: Record<string, string>;
  isValid: boolean;
  needsTaxonomyCreate: boolean;
  issues: string[];
};

/** @deprecated Use getBulkPasteHeaders(preset) instead */
export const bulkPasteColumnHeaders = getBulkPasteHeaders("DRAIN_RING");

/** @deprecated Use bulkPasteExamples[preset] instead */
export const bulkPasteExample = bulkPasteExamples.DRAIN_RING;
