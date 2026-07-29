import { notFound, redirect } from "next/navigation";
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
import { requireAuth } from "@/lib/auth/session";
import { canEditQuote } from "@/lib/quotes/edit-rules";
import { mapQuoteToFormInitialValues } from "@/lib/quote-mapper";
import { listProductTaxonomy } from "@/lib/product-taxonomy.server";
import { withDatabaseRetry } from "@/lib/prisma";
import type { QuoteStatus } from "@/app/generated/prisma/client";

type EditQuotePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditQuotePage({ params }: EditQuotePageProps) {
  const { id } = await params;
  const user = await requireAuth();
  const appSettings = await getAppSettings();
  const defaultExpiration = defaultQuoteExpirationDate(
    appSettings.quoteValidityDays,
  );

  const quote = await withDatabaseRetry((prisma) =>
    prisma.quote.findUnique({
      where: { id },
      include: {
        lineItems: {
          orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
        },
      },
    }),
  );

  if (!quote) {
    notFound();
  }

  let supersededBy: { id: string } | null = null;
  if (quote.status === "REVISED") {
    const rootId = quote.originalQuoteId ?? quote.id;
    supersededBy = await withDatabaseRetry((prisma) =>
      prisma.quote.findFirst({
        where: {
          OR: [{ id: rootId }, { originalQuoteId: rootId }],
          revisionNumber: { gt: quote.revisionNumber },
        },
        orderBy: { revisionNumber: "asc" },
        select: { id: true },
      }),
    );
  }

  if (!canEditQuote(quote.status as QuoteStatus, supersededBy)) {
    redirect(`/quotes/${id}`);
  }

  // Catalogs are fetched on demand by the form. Only the shared reference
  // data and the entities this quote already references are loaded so
  // selected values render without a lookup.
  const [
    { serviceOptions, ringSlabProducts, pipeProducts, priceLists },
    initialCustomerRow,
    initialJobRow,
    taxonomy,
  ] = await Promise.all([
    loadQuoteFormSharedData(appSettings.ringBuilderConfig, quote.priceListId),
    quote.customerId
      ? withDatabaseRetry((prisma) =>
          prisma.customer.findUnique({
            where: { id: quote.customerId! },
            select: QUOTE_FORM_CUSTOMER_SELECT,
          }),
        )
      : null,
    quote.jobId
      ? withDatabaseRetry((prisma) =>
          prisma.job.findUnique({
            where: { id: quote.jobId! },
            select: QUOTE_FORM_JOB_SELECT,
          }),
        )
      : null,
    listProductTaxonomy(),
  ]);

  const initialValues = mapQuoteToFormInitialValues(quote);

  return (
    <DashboardShell
      title={`Edit Quote ${quote.quoteNumber}`}
      subtitle="Update quote details, line items, and pricing."
    >
      <div>
        <QuoteForm
          backHref={`/quotes/${quote.id}`}
          backLabel="Back to Quote"
          quoteId={quote.id}
          initialValues={initialValues}
          expectedUpdatedAt={quote.updatedAt.toISOString()}
          initialCustomer={
            initialCustomerRow
              ? mapCustomerToQuoteFormOption(initialCustomerRow)
              : null
          }
          initialJob={
            initialJobRow ? mapJobToQuoteFormOption(initialJobRow) : null
          }
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
