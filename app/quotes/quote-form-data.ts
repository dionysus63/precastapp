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
import { mapProductToQuoteFormOption } from "@/lib/quote-mapper";
import type { RingBuilderConfig } from "@/lib/ring-builder-settings";

/**
 * Shared selects and row mappers for the quote form's reference data. Used by
 * the new/edit quote pages (to seed the form with the entities a quote already
 * references) and by the typeahead server actions in `actions.ts`.
 */

export const QUOTE_PRODUCT_OPTION_SELECT = {
  id: true,
  productCode: true,
  name: true,
  category: true,
  description: true,
  unit: true,
  defaultPrice: true,
  weight: true,
  yards: true,
  taxable: true,
  castingRole: true,
} satisfies Prisma.ProductSelect;

const QUOTE_SERVICE_OPTION_SELECT = {
  id: true,
  productCode: true,
  name: true,
  description: true,
  unit: true,
  defaultPrice: true,
  taxable: true,
} satisfies Prisma.ProductSelect;

export const QUOTE_FORM_CUSTOMER_SELECT = {
  id: true,
  name: true,
  primaryContactName: true,
  email: true,
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

export function mapCustomerToQuoteFormOption(
  customer: QuoteFormCustomerRow,
): QuoteFormCustomerOption {
  return {
    id: customer.id,
    name: customer.name,
    contactName: customer.primaryContactName ?? "",
    contactEmail: customer.email ?? "",
    contactPhone: customer.phone ?? "",
    contacts: customer.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      title: contact.title ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      isPrimary: contact.isPrimary,
    })),
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
        defaultUnitPrice: product.defaultPrice
          ? Number.parseFloat(product.defaultPrice.toString())
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

  for (const mapping of config) {
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

/**
 * Loads the small reference data the quote form still needs preloaded:
 * price lists, service options, and the ring builder "Other" products.
 *
 * Ring products stay preloaded because the ring builder modal filters them
 * synchronously by subcategory while the user works; instead of the previous
 * full ACTIVE-catalog query, only products matching the subcategories named in
 * the ring builder config are fetched (the modal re-applies the exact match).
 */
export async function loadQuoteFormSharedData(
  ringBuilderConfig: RingBuilderConfig,
) {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const ringSubcategories = collectRingOtherSubcategories(ringBuilderConfig);

  const [serviceProducts, ringProducts, priceLists] = await Promise.all([
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
                  description: { contains: subcategory, mode: "insensitive" },
                }),
              ),
            },
            orderBy: { productCode: "asc" },
            select: QUOTE_PRODUCT_OPTION_SELECT,
          }),
        )
      : Promise.resolve([]),
    withDatabaseRetry((client) =>
      client.priceList.findMany({
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        select: { id: true, name: true, isDefault: true },
      }),
    ),
  ]);

  return {
    serviceOptions: mapServiceProductsToOptions(serviceProducts),
    ringSlabProducts: ringProducts.map(mapProductToQuoteFormOption),
    priceLists,
  };
}
