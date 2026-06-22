import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { QuoteForm } from "@/components/quotes/quote-form";
import {
  type QuoteFormServiceOption,
  mockServiceOptions,
} from "@/components/quotes/quote-utils";
import { listPriceListsForForm } from "@/app/quotes/actions";
import {
  defaultQuoteExpirationDate,
  getAppSettings,
} from "@/lib/app-settings";
import { requireAuth } from "@/lib/auth/session";
import { mapProductToQuoteFormOption } from "@/lib/quote-mapper";
import { withDatabaseRetry } from "@/lib/prisma";

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

type NewQuotePageProps = {
  searchParams: Promise<{
    jobId?: string;
    customerId?: string;
    bidderId?: string;
  }>;
};

export default async function NewQuotePage({
  searchParams,
}: NewQuotePageProps) {
  const { jobId, customerId, bidderId } = await searchParams;
  const user = await requireAuth();
  const appSettings = await getAppSettings();
  const defaultExpiration = defaultQuoteExpirationDate(
    appSettings.quoteValidityDays,
  );

  const [customers, jobs, stockProducts, configurableProducts, serviceProducts, priceLists] =
    await withDatabaseRetry((prisma) =>
      Promise.all([
        prisma.customer.findMany({
          orderBy: { name: "asc" },
          include: {
            contacts: {
              orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
            },
          },
        }),
        prisma.job.findMany({
          orderBy: [{ year: "desc" }, { sequenceNumber: "desc" }],
        }),
        prisma.product.findMany({
          where: { productType: "STOCK", status: "ACTIVE" },
          orderBy: { productCode: "asc" },
        }),
        prisma.product.findMany({
          where: { productType: "CONFIGURABLE", status: "ACTIVE" },
          orderBy: { productCode: "asc" },
        }),
        prisma.product.findMany({
          where: { productType: "SERVICE", status: "ACTIVE" },
          orderBy: { productCode: "asc" },
        }),
        listPriceListsForForm(),
      ]),
    );

  const customerOptions = customers.map((customer) => ({
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
  }));

  const jobOptions = jobs.map((job) => ({
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
  }));

  const serviceOptions: QuoteFormServiceOption[] =
    serviceProducts.length > 0
      ? serviceProducts.map((product) => ({
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
        }))
      : mockServiceOptions.map((service) => ({
          id: null,
          item: service.item,
          description: service.description,
          lineType: service.lineType,
          defaultUnitPrice: service.defaultUnitPrice,
          taxable: service.taxable,
          unit: "EA",
        }));

  return (
    <DashboardShell
      title="New Quote"
      subtitle="Create a quote using stock products, configurable structures, custom structures, and services."
    >
      <Link
        href="/quotes"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Quotes
      </Link>

      <div className="mt-4">
        <QuoteForm
          customers={customerOptions}
          jobs={jobOptions}
          stockProducts={stockProducts.map(mapProductToQuoteFormOption)}
          configurableProducts={configurableProducts.map(
            mapProductToQuoteFormOption,
          )}
          serviceOptions={serviceOptions}
          priceLists={priceLists}
          initialJobId={jobId}
          initialCustomerId={customerId}
          initialJobBidderId={bidderId}
          quoteDefaults={{
            defaultTaxRate: appSettings.defaultTaxRate,
            defaultLeadTime: appSettings.defaultLeadTime,
            defaultExpirationDate: defaultExpiration.toISOString().slice(0, 10),
            estimators: appSettings.estimators,
            paymentTerms: appSettings.paymentTerms,
            defaultEstimator: user.displayName,
          }}
        />
      </div>
    </DashboardShell>
  );
}
