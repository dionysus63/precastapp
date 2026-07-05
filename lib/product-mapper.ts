import type { ProductRow, ProductType } from "@/components/products/product-utils";
import { productTypeLabels } from "@/components/products/product-utils";
import { formatUsd } from "@/lib/format";
import { formatProductKindBadgeLabel } from "@/lib/product-kinds";
import {
  productStatusVariant,
  productTypeVariant,
} from "@/lib/status-variants";

import type { ProductKind } from "@/app/generated/prisma/client";

export type ProductRecord = {
  id: string;
  productCode: string;
  name: string;
  productType: string;
  productKind?: ProductKind;
  description: string | null;
  productCategory: { name: string };
  subcategory?: { name: string } | null;
  unit: string;
  unitPrice?: { toString(): string } | null;
  cost: { toString(): string } | null;
  weight: { toString(): string } | null;
  yards: { toString(): string } | null;
  taxable: boolean;
  trackInventory: boolean;
  currentStockQuantity: number;
  reorderLevel: number;
  yardLocation: string | null;
  status: string;
  notes: string | null;
  isCasting?: boolean;
  castingRole?: string | null;
  castingSoldAsUnit?: boolean;
  manufacturerCode?: string | null;
  castingSupplier?: { origin: string } | null;
  weightDerivedFromParts?: boolean;
  priceDerivedFromParts?: boolean;
  _count?: {
    documents: number;
  };
};

export type ProductDocumentRecord = {
  id: string;
  documentName: string;
  documentType: string;
  uploadedAt: Date;
  fileSize: number | null;
};

export type ProductDetailView = {
  id: string;
  productCode: string;
  productName: string;
  productType: ProductType;
  productTypeLabel: string;
  productTypeVariant: ProductRow["productTypeVariant"];
  category: string;
  subcategory: string;
  description: string;
  unit: string;
  unitPrice: string;
  priceListLabel: string;
  cost: string;
  weight: string;
  yards: string;
  taxable: string;
  trackInventory: string;
  currentStockQuantity: string;
  reorderLevel: string;
  yardLocation: string;
  status: string;
  statusVariant: ProductRow["statusVariant"];
  notes: string;
  manufacturerCode: string;
  weightDerivedFromParts: boolean;
  priceDerivedFromParts: boolean;
  documents: {
    id: string;
    documentName: string;
    documentTypeLabel: string;
    uploadedDate: string;
    fileSize: string;
  }[];
};

const productDocumentTypeLabels: Record<string, string> = {
  GENERIC_SUBMITTAL: "Generic Submittal",
  SHOP_DRAWING: "Shop Drawing",
  CUT_SHEET_TEMPLATE: "Cut Sheet Template",
  SPEC_SHEET: "Spec Sheet",
  INSTALLATION_INSTRUCTIONS: "Installation Instructions",
  OTHER: "Other",
};

const productStatusLabels: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  DISCONTINUED: "Discontinued",
};

function categoryVariant(category: string): ProductRow["categoryVariant"] {
  switch (category) {
    case "Vaults":
      return "info";
    case "Walls":
    case "Slabs":
      return "neutral";
    default:
      return "default";
  }
}

function formatDecimal(value: ProductRecord["weight"]) {
  if (value === null || value === undefined) {
    return "—";
  }

  return String(value);
}

function productTypeLabel(productType: string) {
  return (
    productTypeLabels[productType as ProductType] ??
    productType.replaceAll("_", " ")
  );
}

function formatYesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function formatFileSize(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDocumentDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function documentTypeLabel(documentType: string) {
  return (
    productDocumentTypeLabels[documentType] ??
    documentType.replaceAll("_", " ")
  );
}

export function mapProductToDetail(
  product: ProductRecord,
  documents: ProductDocumentRecord[],
  options?: {
    unitPrice?: { toString(): string } | null;
    priceListName?: string;
    weightDerivedFromParts?: boolean;
    priceDerivedFromParts?: boolean;
  },
): ProductDetailView {
  const weightDerived = options?.weightDerivedFromParts ?? product.weightDerivedFromParts ?? false;
  const priceDerived = options?.priceDerivedFromParts ?? product.priceDerivedFromParts ?? false;
  const weightValue = formatDecimal(product.weight);

  return {
    id: product.id,
    productCode: product.productCode,
    productName: product.name,
    productType: product.productType as ProductType,
    productTypeLabel: productTypeLabel(product.productType),
    productTypeVariant: productTypeVariant(product.productType),
    category: product.productCategory.name,
    subcategory: product.subcategory?.name ?? "—",
    description: product.description ?? "—",
    unit: product.unit,
    unitPrice: `${formatUsd(options?.unitPrice ?? product.unitPrice ?? null)}${
      priceDerived ? " (derived from parts)" : ""
    }`,
    priceListLabel: options?.priceListName ?? "Default price list",
    cost: formatUsd(product.cost),
    weight: `${weightValue}${weightDerived ? " (derived from parts)" : ""}`,
    yards: formatDecimal(product.yards),
    taxable: formatYesNo(product.taxable),
    trackInventory: formatYesNo(product.trackInventory),
    currentStockQuantity: String(product.currentStockQuantity),
    reorderLevel: String(product.reorderLevel),
    yardLocation: product.yardLocation ?? "—",
    status: productStatusLabels[product.status] ?? product.status,
    statusVariant: productStatusVariant(product.status),
    notes: product.notes ?? "—",
    manufacturerCode: product.manufacturerCode?.trim() || "—",
    weightDerivedFromParts: weightDerived,
    priceDerivedFromParts: priceDerived,
    documents: documents.map((document) => ({
      id: document.id,
      documentName: document.documentName,
      documentTypeLabel: documentTypeLabel(document.documentType),
      uploadedDate: formatDocumentDate(document.uploadedAt),
      fileSize: formatFileSize(document.fileSize),
    })),
  };
}

export function mapProductToRow(product: ProductRecord): ProductRow {
  const productKind = product.productKind ?? "STANDARD";
  const kindLabel = formatProductKindBadgeLabel(productKind);
  const weightDerived = product.weightDerivedFromParts ?? false;
  const priceDerived = product.priceDerivedFromParts ?? false;
  const weightValue = formatDecimal(product.weight);

  return {
    id: product.id,
    productCode: product.productCode,
    productName: product.name,
    productType: product.productType as ProductType,
    productTypeLabel: productTypeLabel(product.productType),
    productTypeVariant: productTypeVariant(product.productType),
    category: product.productCategory.name,
    subcategory: product.subcategory?.name?.trim() || "—",
    categoryVariant: categoryVariant(product.productCategory.name),
    unit: product.unit,
    unitPrice: `${formatUsd(product.unitPrice ?? null)}${
      priceDerived ? " *" : ""
    }`,
    weight: `${weightValue}${weightDerived ? " *" : ""}`,
    yards: formatDecimal(product.yards),
    trackInventory: product.trackInventory,
    status: productStatusLabels[product.status] ?? product.status,
    statusVariant: productStatusVariant(product.status),
    submittalCount: product._count?.documents ?? 0,
    isCasting: product.isCasting ?? false,
    castingRole: product.castingRole ?? undefined,
    productKind,
    productKindLabel: kindLabel ?? undefined,
    castingOrigin: product.castingSupplier?.origin ?? null,
    castingSoldAsUnit: product.castingSoldAsUnit ?? false,
  };
}
