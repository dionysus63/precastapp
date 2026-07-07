import type { Product } from "@/app/generated/prisma/client";
import {
  isPipeProductType,
  productTypeLabels,
  type ProductType,
} from "@/lib/product-types";
import {
  formatAdsPipeJointTypeLabel,
  normalizeAdsPipeJointType,
} from "@/lib/ads-pipe-utils";
import { formatRcpPipeJointTypeLabel } from "@/lib/rcp-pipe-utils";
import {
  buildWorkbookBuffer,
  formatExportDate,
  formatOptionalDecimal,
  formatOptionalString,
  formatYesNo,
} from "@/lib/excel-export";
import { productKindLabels } from "@/lib/product-kinds";
import {
  enrichProductWithDerivedAssemblyValues,
  isDerivableCastingAssembly,
  loadDerivedAssemblyValues,
} from "@/lib/casting-service";
import { getDefaultPriceList, getProductPricesForList } from "@/lib/price-list-service";
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
  "Description",
  "Unit",
  "Unit Price",
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
  "Manufacturer Code",
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

function mapProductToExportRow(
  product: Product & {
    productCategory: { name: string };
    subcategory: { name: string } | null;
    weightDerivedFromParts?: boolean;
    priceDerivedFromParts?: boolean;
  },
  unitPrice: { toString(): string } | null | undefined,
): unknown[] {
  const productType =
    productTypeLabels[product.productType as ProductType] ??
    product.productType.replaceAll("_", " ");

  const isRing = product.productKind === "DRAIN_RING";
  const isCasting =
    product.productKind === "CASTING_ASSEMBLY" ||
    product.productKind === "CASTING_COMPONENT";
  const isPipe = isPipeProductType(product.productType);
  const isAdsPipe = product.productType === "ADS_PIPE";
  const isPrecastPipe = product.productType === "PRECAST_PIPE";

  return [
    product.productCode,
    product.name,
    productType,
    productKindLabels[product.productKind],
    product.productCategory.name,
    formatOptionalString(product.subcategory?.name),
    formatOptionalString(product.description),
    product.unit,
    formatOptionalDecimal(unitPrice ?? null),
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
    formatOptionalString(product.manufacturerCode),
    product.productKind === "CASTING_ASSEMBLY"
      ? formatOptionalDecimal(product.castingClearOpeningInches)
      : "",
    formatOptionalString(product.castingSupplierId),
    isPipe ? formatOptionalDecimal(product.pipeDiameterInches) : "",
    isPipe ? formatOptionalDecimal(product.pipeLengthFeet) : "",
    isPrecastPipe ? formatOptionalString(product.pipeClass) : "",
    isPipe
      ? isAdsPipe
        ? formatAdsPipeJointTypeLabel(
            normalizeAdsPipeJointType(product.pipeJointType),
          )
        : isPrecastPipe
          ? formatRcpPipeJointTypeLabel()
          : formatOptionalString(product.pipeJointType)
      : "",
    product.id,
    formatExportDate(product.createdAt),
    formatExportDate(product.updatedAt),
  ];
}

export async function buildProductsExportBuffer(
  priceListId?: string | null,
): Promise<Buffer> {
  const products = await prisma.product.findMany({
    orderBy: { productCode: "asc" },
    include: {
      productCategory: { select: { name: true } },
      subcategory: { select: { name: true } },
    },
  });

  const resolvedPriceListId =
    priceListId ??
    (await getDefaultPriceList(prisma))?.id ??
    null;

  const priceMap = resolvedPriceListId
    ? await getProductPricesForList(
        products.map((product) => product.id),
        resolvedPriceListId,
      )
    : new Map();

  const derivableAssemblyIds = products
    .filter((product) => isDerivableCastingAssembly(product))
    .map((product) => product.id);
  const derivedMap = derivableAssemblyIds.length
    ? await loadDerivedAssemblyValues(prisma, derivableAssemblyIds, resolvedPriceListId)
    : new Map();

  return buildWorkbookBuffer(
    [...productExportHeaders],
    products.map((product) => {
      const enriched = enrichProductWithDerivedAssemblyValues(
        product,
        priceMap.get(product.id),
        derivedMap.get(product.id),
      );
      return mapProductToExportRow(
        enriched,
        enriched.unitPrice ?? undefined,
      );
    }),
  );
}
