import type { ProductRow, ProductType } from "@/components/products/product-utils";
import { productTypeLabels } from "@/components/products/product-utils";

export type ProductRecord = {
  id: string;
  productCode: string;
  name: string;
  productType: string;
  category: string;
  description: string | null;
  unit: string;
  defaultPrice: { toString(): string } | null;
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
  description: string;
  unit: string;
  defaultPrice: string;
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

function statusVariant(status: string): ProductRow["statusVariant"] {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "DISCONTINUED":
      return "warning";
    default:
      return "neutral";
  }
}

function productTypeVariant(productType: string): ProductRow["productTypeVariant"] {
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

function formatCurrency(value: ProductRecord["defaultPrice"]) {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
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
): ProductDetailView {
  return {
    id: product.id,
    productCode: product.productCode,
    productName: product.name,
    productType: product.productType as ProductType,
    productTypeLabel: productTypeLabel(product.productType),
    productTypeVariant: productTypeVariant(product.productType),
    category: product.category,
    description: product.description ?? "—",
    unit: product.unit,
    defaultPrice: formatCurrency(product.defaultPrice),
    cost: formatCurrency(product.cost),
    weight: formatDecimal(product.weight),
    yards: formatDecimal(product.yards),
    taxable: formatYesNo(product.taxable),
    trackInventory: formatYesNo(product.trackInventory),
    currentStockQuantity: String(product.currentStockQuantity),
    reorderLevel: String(product.reorderLevel),
    yardLocation: product.yardLocation ?? "—",
    status: productStatusLabels[product.status] ?? product.status,
    statusVariant: statusVariant(product.status),
    notes: product.notes ?? "—",
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
  return {
    id: product.id,
    productCode: product.productCode,
    productName: product.name,
    productType: product.productType as ProductType,
    productTypeLabel: productTypeLabel(product.productType),
    productTypeVariant: productTypeVariant(product.productType),
    category: product.category,
    subcategory: "—",
    categoryVariant: categoryVariant(product.category),
    unit: product.unit,
    defaultPrice: formatCurrency(product.defaultPrice),
    weight: formatDecimal(product.weight),
    yards: formatDecimal(product.yards),
    trackInventory: product.trackInventory,
    status: productStatusLabels[product.status] ?? product.status,
    statusVariant: statusVariant(product.status),
  };
}
