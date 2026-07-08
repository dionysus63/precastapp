import { AppPermission } from "@/app/generated/prisma/client";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  type QuoteFormCustomerOption,
  type QuoteFormJobOption,
  type QuoteFormServiceOption,
  mockServiceOptions,
} from "@/components/quotes/quote-utils";
import { requirePermission } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import { getProductPricesForList } from "@/lib/price-list-service";
import { mapProductToQuoteFormOption } from "@/lib/quote-mapper";
import {
  mergeRingBuilderConfigWithDefaults,
  type RingBuilderConfig,
} from "@/lib/ring-builder-settings";

/**
 * Shared selects and row mappers for the quote form's reference data. Used by
 * the new/edit quote pages (to seed the form with the entities a quote already
 * references) and by the typeahead server actions in `actions.ts`.
 */

export const QUOTE_PRODUCT_OPTION_SELECT = {
  id: true,
  productCode: true,
  name: true,
  description: true,
  unit: true,
  weight: true,
  yards: true,
  taxable: true,
  castingRole: true,
  castingSoldAsUnit: true,
  manufacturerCode: true,
  productCategory: {
    select: { name: true },
  },
  subcategory: {
    select: { name: true },
  },
  castingSupplier: {
    select: { origin: true },
  },
} satisfies Prisma.ProductSelect;

export const QUOTE_PIPE_PRODUCT_SELECT = {
  id: true,
  productCode: true,
  name: true,
  description: true,
  productType: true,
  unit: true,
  weight: true,
  taxable: true,
  pipeDiameterInches: true,
  pipeLengthFeet: true,
  pipeClass: true,
  pipeJointType: true,
} satisfies Prisma.ProductSelect;

const QUOTE_SERVICE_OPTION_SELECT = {
  id: true,
  productCode: true,
  name: true,
  description: true,
  unit: true,
  taxable: true,
} satisfies Prisma.ProductSelect;

export const QUOTE_FORM_CUSTOMER_SELECT = {
  id: true,
  name: true,
  phone: true,
  contacts: {
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      title: true,
      email: true,
      phone: true,
      isPrimary: true,
    },
  },
  contactRoleDefaults: {
    where: { role: "ESTIMATING" },
    select: { contactId: true },
  },
} satisfies Prisma.CustomerSelect;

export const QUOTE_FORM_JOB_SELECT = {
  id: true,
  jobNumber: true,
  projectName: true,
  projectAddress: true,
  city: true,
  state: true,
  zip: true,
  customerId: true,
  customerName: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
} satisfies Prisma.JobSelect;

export type QuoteFormCustomerRow = Prisma.CustomerGetPayload<{
  select: typeof QUOTE_FORM_CUSTOMER_SELECT;
}>;

export type QuoteFormJobRow = Prisma.JobGetPayload<{
  select: typeof QUOTE_FORM_JOB_SELECT;
}>;

type QuoteFormServiceProductRow = Prisma.ProductGetPayload<{
  select: typeof QUOTE_SERVICE_OPTION_SELECT;
}>;

type QuoteFormPipeProductRow = Prisma.ProductGetPayload<{
  select: typeof QUOTE_PIPE_PRODUCT_SELECT;
}>;

export function mapPipeProductToQuoteOption(
  product: QuoteFormPipeProductRow,
  price: import("@/app/generated/prisma/client").Prisma.Decimal | undefined,
): import("@/lib/quotes/types").QuotePipeProductOption {
  const productType =
    product.productType === "ADS_PIPE" || product.productType === "PRECAST_PIPE"
      ? product.productType
      : "PRECAST_PIPE";

  return {
    id: product.id,
    code: product.productCode,
    name: product.name,
    description: product.description?.trim() || product.name,
    productType,
    pipeDiameterInches: product.pipeDiameterInches
      ? Number.parseFloat(product.pipeDiameterInches.toString())
      : 0,
    pipeLengthFeet: product.pipeLengthFeet
      ? Number.parseFloat(product.pipeLengthFeet.toString())
      : 0,
    pipeClass: product.pipeClass,
    pipeJointType: product.pipeJointType,
    unit: product.unit,
    unitPrice: price
      ? Number.parseFloat(price.toString())
      : 0,
    weightLb: product.weight
      ? Number.parseFloat(product.weight.toString())
      : 0,
    taxable: product.taxable,
  };
}

export async function loadPipeProductsForQuoteForm(priceListId: string | null) {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const pipeProducts = await withDatabaseRetry((client) =>
    client.product.findMany({
      where: {
        status: "ACTIVE",
        productType: { in: ["ADS_PIPE", "PRECAST_PIPE"] },
      },
      orderBy: [{ pipeDiameterInches: "asc" }, { productCode: "asc" }],
      select: QUOTE_PIPE_PRODUCT_SELECT,
    }),
  );

  const priceMap = priceListId
    ? await getProductPricesForList(
        pipeProducts.map((product) => product.id),
        priceListId,
      )
    : new Map();

  return pipeProducts.map((product) =>
    mapPipeProductToQuoteOption(product, priceMap.get(product.id)),
  );
}

export function mapCustomerToQuoteFormOption(
  customer: QuoteFormCustomerRow,
): QuoteFormCustomerOption {
  const estimatingContactId =
    customer.contactRoleDefaults[0]?.contactId ?? null;
  // Header-level contact fields come from the default contact now that the
  // customer record no longer mirrors one: estimating default -> Main -> first.
  const defaultContact =
    (estimatingContactId
      ? customer.contacts.find((c) => c.id === estimatingContactId)
      : null) ??
    customer.contacts.find((c) => c.isPrimary) ??
    customer.contacts[0] ??
    null;

  return {
    id: customer.id,
    name: customer.name,
    contactName: defaultContact?.name ?? "",
    contactEmail: defaultContact?.email ?? "",
    contactPhone: defaultContact?.phone ?? customer.phone ?? "",
    contacts: customer.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      title: contact.title ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      isPrimary: contact.isPrimary,
    })),
    estimatingContactId,
  };
}

function formatJobAddress(job: {
  projectAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}) {
  const parts = [
    job.projectAddress,
    [job.city, job.state].filter(Boolean).join(", "),
    job.zip,
  ].filter((part) => part && part.trim() !== "");

  return parts.join(", ");
}

export function mapJobToQuoteFormOption(job: QuoteFormJobRow): QuoteFormJobOption {
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    label: `${job.jobNumber} - ${job.projectName} - ${job.customerName}`,
    projectName: job.projectName,
    projectAddress: formatJobAddress(job),
    customerId: job.customerId,
    customerName: job.customerName,
    contactName: job.contactName ?? "",
    contactEmail: job.contactEmail ?? "",
    contactPhone: job.contactPhone ?? "",
  };
}

function mapServiceProductsToOptions(
  serviceProducts: QuoteFormServiceProductRow[],
  priceMap: Map<string, import("@/app/generated/prisma/client").Prisma.Decimal>,
): QuoteFormServiceOption[] {
  if (serviceProducts.length > 0) {
    return serviceProducts.map(
      (product): QuoteFormServiceOption => ({
        id: product.id,
        item: product.productCode,
        description: product.description?.trim() || product.name,
        lineType: product.productCode.toLowerCase().includes("misc")
          ? "MISC"
          : "SERVICE",
        defaultUnitPrice: priceMap.has(product.id)
          ? Number.parseFloat(priceMap.get(product.id)!.toString())
          : 0,
        taxable: product.taxable,
        unit: product.unit,
      }),
    );
  }

  return mockServiceOptions.map(
    (service): QuoteFormServiceOption => ({
      id: null,
      item: service.item,
      description: service.description,
      lineType: service.lineType,
      defaultUnitPrice: service.defaultUnitPrice,
      taxable: service.taxable,
      unit: "EA",
    }),
  );
}

function collectRingOtherSubcategories(config: RingBuilderConfig): string[] {
  const seen = new Set<string>();
  const subcategories: string[] = [];
  const merged = mergeRingBuilderConfigWithDefaults(config);

  for (const mapping of merged) {
    for (const subcategory of mapping.otherSubcategories) {
      const trimmed = subcategory.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) {
        continue;
      }
      seen.add(key);
      subcategories.push(trimmed);
    }
  }

  return subcategories;
}

export async function loadQuoteFormPriceOptions(
  priceListId: string | null,
  ringBuilderConfig: RingBuilderConfig,
) {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const ringSubcategories = collectRingOtherSubcategories(ringBuilderConfig);

  const [serviceProducts, ringProducts, pipeProducts] = await Promise.all([
    withDatabaseRetry((client) =>
      client.product.findMany({
        where: { productType: "SERVICE", status: "ACTIVE" },
        orderBy: { productCode: "asc" },
        select: QUOTE_SERVICE_OPTION_SELECT,
      }),
    ),
    ringSubcategories.length > 0
      ? withDatabaseRetry((client) =>
          client.product.findMany({
            where: {
              status: "ACTIVE",
              OR: ringSubcategories.map(
                (subcategory): Prisma.ProductWhereInput => ({
                  subcategory: {
                    name: { equals: subcategory, mode: "insensitive" },
                  },
                }),
              ),
            },
            orderBy: { productCode: "asc" },
            select: QUOTE_PRODUCT_OPTION_SELECT,
          }),
        )
      : Promise.resolve([]),
    loadPipeProductsForQuoteForm(priceListId),
  ]);

  const productIds = [
    ...serviceProducts.map((product) => product.id),
    ...ringProducts.map((product) => product.id),
  ];
  const priceMap = priceListId
    ? await getProductPricesForList(productIds, priceListId)
    : new Map();

  return {
    serviceOptions: mapServiceProductsToOptions(serviceProducts, priceMap),
    ringSlabProducts: ringProducts.map((product) =>
      mapProductToQuoteFormOption(product, priceMap.get(product.id)),
    ),
    pipeProducts,
  };
}

/**
 * Loads the small reference data the quote form still needs preloaded:
 * price lists, service options, and the ring builder "Other" products.
 *
 * Ring products stay preloaded because the ring builder modal filters them
 * synchronously by subcategory while the user works; instead of the previous
 * full ACTIVE-catalog query, only products matching the subcategories named in
 * the ring builder config are fetched by subcategory name (the modal re-applies
 * the per diameter/style filter).
 */
export async function loadQuoteFormSharedData(
  ringBuilderConfig: RingBuilderConfig,
  priceListId?: string | null,
) {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const priceLists = await withDatabaseRetry((client) =>
    client.priceList.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
  );

  const resolvedPriceListId =
    priceListId ??
    priceLists.find((list) => list.isDefault)?.id ??
    priceLists[0]?.id ??
    null;

  const pricedOptions = await loadQuoteFormPriceOptions(
    resolvedPriceListId,
    ringBuilderConfig,
  );

  return {
    ...pricedOptions,
    priceLists,
  };
}
