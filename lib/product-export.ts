import type { Product } from "@/app/generated/prisma/client";
import {
  productTypeLabels,
  type ProductType,
} from "@/components/products/product-utils";
import {
  buildWorkbookBuffer,
  formatExportDate,
  formatOptionalDecimal,
  formatOptionalString,
  formatYesNo,
} from "@/lib/excel-export";
import { prisma } from "@/lib/prisma";

const productStatusLabels: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  DISCONTINUED: "Discontinued",
};

function formatDrainRingStyle(value: string): string {
  if (value === "SANITARY") {
    return "SAN";
  }
  if (value === "SOLID") {
    return "SOL";
  }
  return "DRAIN";
}

export const productExportHeaders = [
  "Product Code",
  "Product Name",
  "Product Type",
  "Category",
  "Subcategory",
  "Unit",
  "Default Price",
  "Cost",
  "Weight",
  "Yards",
  "Taxable",
  "Track Inventory",
  "Current Stock",
  "Reorder Level",
  "Yard Location",
  "Status",
  "Notes",
  "Ring",
  "Ring Diameter (ft)",
  "Ring Height (ft)",
  "Style (DRAIN/SAN/SOL)",
  "Product ID",
  "Created",
  "Updated",
] as const;

function mapProductToExportRow(product: Product): unknown[] {
  const productType =
    productTypeLabels[product.productType as ProductType] ??
    product.productType.replaceAll("_", " ");

  return [
    product.productCode,
    product.name,
    productType,
    product.category,
    formatOptionalString(product.description),
    product.unit,
    formatOptionalDecimal(product.defaultPrice),
    formatOptionalDecimal(product.cost),
    formatOptionalDecimal(product.weight),
    formatOptionalDecimal(product.yards),
    formatYesNo(product.taxable),
    formatYesNo(product.trackInventory),
    product.currentStockQuantity,
    product.reorderLevel,
    formatOptionalString(product.yardLocation),
    productStatusLabels[product.status] ?? product.status,
    formatOptionalString(product.notes),
    formatYesNo(product.isDrainRing),
    formatOptionalDecimal(product.ringDiameterFeet),
    formatOptionalDecimal(product.heightFeet),
    product.isDrainRing ? formatDrainRingStyle(product.drainRingStyle) : "",
    product.id,
    formatExportDate(product.createdAt),
    formatExportDate(product.updatedAt),
  ];
}

export async function buildProductsExportBuffer(): Promise<Buffer> {
  const products = await prisma.product.findMany({
    orderBy: { productCode: "asc" },
  });

  return buildWorkbookBuffer(
    [...productExportHeaders],
    products.map(mapProductToExportRow),
  );
}
