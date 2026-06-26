import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ProductsList } from "@/components/products/products-list";
import { mapProductToRow } from "@/lib/product-mapper";
import { getProductCatalog } from "@/lib/product-catalog-settings.server";
import { PRODUCT_SUBMITTAL_DOCUMENT_TYPES } from "@/lib/product-submittals-service";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  productStatusFormOptions,
  productTypeFormOptions,
} from "@/components/products/product-utils";
import {
  buildPageInfo,
  parsePageParam,
  parseStringParam,
  type RawSearchParams,
} from "@/lib/list-params";
import type { ProductCatalogInUsePair } from "@/lib/product-catalog-settings";
import type { Prisma } from "@/app/generated/prisma/client";

const VALID_PRODUCT_TYPES = new Set(
  productTypeFormOptions.map((option) => option.value),
);
const VALID_PRODUCT_STATUSES = new Set(
  productStatusFormOptions.map((option) => option.value),
);

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const search = parseStringParam(params.q);
  const typeParam = parseStringParam(params.type);
  const categoryParam = parseStringParam(params.category);
  const subcategoryParam = parseStringParam(params.subcategory);
  const statusParam = parseStringParam(params.status);
  const inventoryParam = parseStringParam(params.inventory);
  const submittalsParam = parseStringParam(params.submittals);
  const requestedPage = parsePageParam(params.page);

  const submittalDocFilter = {
    documentType: { in: PRODUCT_SUBMITTAL_DOCUMENT_TYPES },
  };

  const where: Prisma.ProductWhereInput = {
    ...(typeParam && VALID_PRODUCT_TYPES.has(typeParam)
      ? { productType: typeParam as Prisma.ProductWhereInput["productType"] }
      : {}),
    ...(statusParam && VALID_PRODUCT_STATUSES.has(statusParam)
      ? { status: statusParam as Prisma.ProductWhereInput["status"] }
      : {}),
    ...(categoryParam ? { category: categoryParam } : {}),
    ...(subcategoryParam ? { description: subcategoryParam } : {}),
    ...(inventoryParam === "Yes"
      ? { trackInventory: true }
      : inventoryParam === "No"
        ? { trackInventory: false }
        : {}),
    ...(submittalsParam === "Has submittals"
      ? { documents: { some: submittalDocFilter } }
      : submittalsParam === "Missing submittals"
        ? { documents: { none: submittalDocFilter } }
        : {}),
    ...(search
      ? {
          OR: [
            { productCode: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const total = await withDatabaseRetry((prisma) =>
    prisma.product.count({ where }),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

  const [products, catalog, inUseRows] = await withDatabaseRetry((prisma) =>
    Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        skip: pageInfo.skip,
        take: pageInfo.take,
        include: {
          _count: {
            select: {
              documents: { where: submittalDocFilter },
            },
          },
        },
      }),
      getProductCatalog(),
      prisma.product.findMany({
        distinct: ["category", "description"],
        select: { category: true, description: true },
      }),
    ]),
  );

  const rows = products.map(mapProductToRow);
  const inUsePairs: ProductCatalogInUsePair[] = inUseRows.map((row) => ({
    category: row.category,
    subcategory: row.description?.trim() || "—",
  }));

  return (
    <DashboardShell
      title="Products"
      subtitle="Manage precast product catalog, pricing, and inventory tracking."
    >
      <ProductsList
        products={rows}
        catalog={catalog}
        inUsePairs={inUsePairs}
        pageInfo={pageInfo}
        filters={{
          search,
          type: typeParam,
          category: categoryParam,
          subcategory: subcategoryParam,
          status: statusParam,
          inventory: inventoryParam,
          submittals: submittalsParam,
        }}
      />
    </DashboardShell>
  );
}
