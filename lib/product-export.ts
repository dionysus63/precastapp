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
import { productKindLabels } from "@/lib/product-kinds";
import { prisma } from "@/lib/prisma";
import {
  formatCastingPieceRoleLabel,
  formatCastingRoleLabel,
} from "@/lib/casting-utils";

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
  "Product Kind",
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
  "Ring Diameter (ft)",
  "Ring Height (ft)",
  "Style (DRAIN/SAN/SOL)",
  "Casting Role",
  "Casting Piece Role",
  "Casting Clear Opening (in)",
  "Casting Supplier ID",
  "Pipe Diameter (in)",
  "Pipe Length (ft)",
  "Pipe Class",
  "Pipe Joint Type",
  "Product ID",
  "Created",
  "Updated",
] as const;

function mapProductToExportRow(product: Product): unknown[] {
  const productType =
    productTypeLabels[product.productType as ProductType] ??
    product.productType.replaceAll("_", " ");

  const isRing = product.productKind === "DRAIN_RING";
  const isCasting =
    product.productKind === "CASTING_ASSEMBLY" ||
    product.productKind === "CASTING_COMPONENT";

  return [
    product.productCode,
    product.name,
    productType,
    productKindLabels[product.productKind],
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
    isRing ? formatOptionalDecimal(product.ringDiameterFeet) : "",
    isRing ? formatOptionalDecimal(product.heightFeet) : "",
    isRing ? formatDrainRingStyle(product.drainRingStyle) : "",
    isCasting ? formatCastingRoleLabel(product.castingRole) : "",
    isCasting
      ? formatCastingPieceRoleLabel(product.castingPieceRole)
      : "",
    product.productKind === "CASTING_ASSEMBLY"
      ? formatOptionalDecimal(product.castingClearOpeningInches)
      : "",
    formatOptionalString(product.castingSupplierId),
    product.productKind === "PIPE"
      ? formatOptionalDecimal(product.pipeDiameterInches)
      : "",
    product.productKind === "PIPE"
      ? formatOptionalDecimal(product.pipeLengthFeet)
      : "",
    product.productKind === "PIPE" ? formatOptionalString(product.pipeClass) : "",
    product.productKind === "PIPE"
      ? formatOptionalString(product.pipeJointType)
      : "",
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
