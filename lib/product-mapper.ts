import type { ProductRow } from "@/components/products/product-utils";

export type ProductRecord = {
  id: string;
  productCode: string;
  productName: string;
  category: string;
  subcategory: string | null;
  unit: string;
  defaultPrice: { toString(): string } | null;
  weight: { toString(): string } | null;
  yards: { toString(): string } | null;
  trackInventory: boolean;
  status: string;
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

export function mapProductToRow(product: ProductRecord): ProductRow {
  return {
    id: product.id,
    productCode: product.productCode,
    productName: product.productName,
    category: product.category,
    subcategory: product.subcategory ?? "—",
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
