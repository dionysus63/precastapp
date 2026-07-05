import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ImportFeedbackBanner } from "@/components/common/import-feedback-banner";
import { ProductsList } from "@/components/products/products-list";
import { mapProductToRow } from "@/lib/product-mapper";
import {
  enrichProductWithDerivedAssemblyValues,
  isDerivableCastingAssembly,
  loadDerivedAssemblyValues,
} from "@/lib/casting-service";
import { getDefaultPriceList, getProductPricesForList } from "@/lib/price-list-service";
import { listProductTaxonomy } from "@/lib/product-taxonomy.server";
import { PRODUCT_SUBMITTAL_DOCUMENT_TYPES } from "@/lib/product-submittals-service";
import { loadEffectiveSubmittalCountsByProductId } from "@/lib/submittal-package";
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
import type { Prisma } from "@/app/generated/prisma/client";

const VALID_PRODUCT_TYPES = new Set<string>(
  productTypeFormOptions.map((option) => option.value),
);
const VALID_PRODUCT_STATUSES = new Set<string>(
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
  const submittalsParam = parseStringParam(params.submittals);
  const castingOriginParam = parseStringParam(params.castingOrigin);
  const requestedPage = parsePageParam(params.page);
  const importedCount = Number.parseInt(parseStringParam(params.imported) ?? "", 10);
  const updatedCount = Number.parseInt(parseStringParam(params.updated) ?? "", 10);
  const imported =
    Number.isFinite(importedCount) && importedCount > 0 ? importedCount : 0;
  const updated =
    Number.isFinite(updatedCount) && updatedCount > 0 ? updatedCount : 0;

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
    ...(categoryParam && categoryParam !== "All"
      ? { categoryId: categoryParam }
      : {}),
    ...(subcategoryParam && subcategoryParam !== "All"
      ? { subcategoryId: subcategoryParam }
      : {}),
    ...(submittalsParam === "Has submittals"
      ? { documents: { some: submittalDocFilter } }
      : submittalsParam === "Missing submittals"
        ? { documents: { none: submittalDocFilter } }
        : {}),
    ...(typeParam === "CASTING" && castingOriginParam === "Domestic"
      ? { castingSupplier: { origin: "DOMESTIC" } }
      : typeParam === "CASTING" && castingOriginParam === "Imported"
        ? { castingSupplier: { origin: "IMPORTED" } }
        : {}),
    ...(search
      ? {
          OR: [
            { productCode: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { productCategory: { name: { contains: search, mode: "insensitive" } } },
            { subcategory: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const total = await withDatabaseRetry((prisma) =>
    prisma.product.count({ where }),
  );
  const pageInfo = buildPageInfo(total, requestedPage);

  const [products, taxonomy, defaultPriceList] = await withDatabaseRetry((prisma) =>
    Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        skip: pageInfo.skip,
        take: pageInfo.take,
        include: {
          productCategory: { select: { name: true } },
          subcategory: { select: { name: true } },
          castingSupplier: { select: { origin: true } },
          _count: {
            select: {
              documents: { where: submittalDocFilter },
            },
          },
        },
      }),
      listProductTaxonomy(),
      getDefaultPriceList(prisma),
    ]),
  );

  // All three enrichments depend only on the fetched page of products, not on
  // each other — load them in parallel instead of three sequential waits.
  const derivableAssemblyIds = products
    .filter((product) => isDerivableCastingAssembly(product))
    .map((product) => product.id);
  const [priceMap, derivedMap, effectiveSubmittalCounts] = await Promise.all([
    defaultPriceList
      ? getProductPricesForList(
          products.map((product) => product.id),
          defaultPriceList.id,
        )
      : Promise.resolve(new Map()),
    derivableAssemblyIds.length
      ? withDatabaseRetry((client) =>
          loadDerivedAssemblyValues(
            client,
            derivableAssemblyIds,
            defaultPriceList?.id,
          ),
        )
      : Promise.resolve(new Map()),
    withDatabaseRetry((client) =>
      loadEffectiveSubmittalCountsByProductId(
        client,
        products.map((product) => product.id),
      ),
    ),
  ]);

  const rows = products.map((product) =>
    mapProductToRow({
      ...enrichProductWithDerivedAssemblyValues(
        product,
        priceMap.get(product.id),
        derivedMap.get(product.id),
      ),
      _count: {
        documents: effectiveSubmittalCounts.get(product.id) ?? product._count.documents,
      },
    }),
  );

  return (
    <DashboardShell
      title="Products"
      subtitle="Manage precast product catalog, pricing, and inventory tracking."
    >
      <ImportFeedbackBanner
        imported={imported}
        updated={updated}
        noun="product"
      />
      <ProductsList
        products={rows}
        taxonomy={taxonomy}
        pageInfo={pageInfo}
        filters={{
          search,
          type: typeParam,
          category: categoryParam,
          subcategory: subcategoryParam,
          status: statusParam,
          submittals: submittalsParam,
          castingOrigin: castingOriginParam,
        }}
      />
    </DashboardShell>
  );
}
