import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { QuoteForm } from "@/components/quotes/quote-form";
import {
  QUOTE_FORM_CUSTOMER_SELECT,
  QUOTE_FORM_JOB_SELECT,
  loadQuoteFormSharedData,
  mapCustomerToQuoteFormOption,
  mapJobToQuoteFormOption,
} from "@/app/quotes/quote-form-data";
import {
  defaultQuoteExpirationDate,
  getAppSettings,
} from "@/lib/app-settings";
import { listProductTaxonomy } from "@/lib/product-taxonomy.server";
import { requireAuth } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";

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

  // Catalogs are no longer preloaded; the form fetches customers, jobs, and
  // products on demand. Only the small shared reference data plus any
  // entities named in the query string are resolved here.
  const [{ serviceOptions, ringSlabProducts, pipeProducts, priceLists }, initialJobRow, taxonomy] =
    await Promise.all([
      loadQuoteFormSharedData(appSettings.ringBuilderConfig),
      jobId
        ? withDatabaseRetry((prisma) =>
            prisma.job.findUnique({
              where: { id: jobId },
              select: QUOTE_FORM_JOB_SELECT,
            }),
          )
        : null,
      listProductTaxonomy(),
    ]);

  const initialJob = initialJobRow
    ? mapJobToQuoteFormOption(initialJobRow)
    : null;
  const resolvedCustomerId = customerId || initialJob?.customerId || null;
  const initialCustomerRow = resolvedCustomerId
    ? await withDatabaseRetry((prisma) =>
        prisma.customer.findUnique({
          where: { id: resolvedCustomerId },
          select: QUOTE_FORM_CUSTOMER_SELECT,
        }),
      )
    : null;
  const initialCustomer = initialCustomerRow
    ? mapCustomerToQuoteFormOption(initialCustomerRow)
    : null;

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
          initialCustomer={initialCustomer}
          initialJob={initialJob}
          initialCustomerId={customerId}
          initialJobBidderId={bidderId}
          serviceOptions={serviceOptions}
          priceLists={priceLists}
          ringBuilderConfig={appSettings.ringBuilderConfig}
          ringSlabProducts={ringSlabProducts}
          pipeProducts={pipeProducts}
          taxonomy={taxonomy}
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
