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
import { toLocalDayInput } from "@/lib/date-only";
import { listProductTaxonomy } from "@/lib/product-taxonomy.server";
import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import { jobQuickBuildLinks } from "@/lib/quotes/quick-build-links";
import { quoteFromSheetsNotes } from "@/lib/quotes/quote-from-sheets";
import { loadQuoteLinesFromJobSheets } from "@/lib/quotes/quote-from-sheets-load";

type NewQuotePageProps = {
  searchParams: Promise<{
    jobId?: string;
    customerId?: string;
    bidderId?: string;
    /**
     * Start from the job's saved Quick Build sheets: "all", or the ids of
     * the sheets to take, comma-separated (see quoteFromSheetsHref).
     */
    fromSheets?: string;
  }>;
};

export default async function NewQuotePage({
  searchParams,
}: NewQuotePageProps) {
  const { jobId, customerId, bidderId, fromSheets } = await searchParams;
  const user = await requireAuth();
  const appSettings = await getAppSettings();
  const defaultExpiration = defaultQuoteExpirationDate(
    appSettings.quoteValidityDays,
  );

  // Catalogs are no longer preloaded; the form fetches customers, jobs, and
  // products on demand. Only the small shared reference data plus any
  // entities named in the query string are resolved here.
  const [{ serviceOptions, ringSlabProducts, pipeProducts, priceLists, discountPricing }, initialJobRow, taxonomy] =
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

  // Job page → Quick Build → Create Quote: the saved structures and their
  // castings are already on the form, priced from the list the form opens on.
  const sheetIds =
    fromSheets && fromSheets !== "all"
      ? fromSheets
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];
  const sheetLines =
    fromSheets &&
    initialJob &&
    (await hasPermission(user, AppPermission.QUOTES_MANAGE))
      ? await loadQuoteLinesFromJobSheets(
          initialJob.id,
          sheetIds.length > 0 ? sheetIds : null,
          priceLists.find((list) => list.isDefault)?.id ??
            priceLists[0]?.id ??
            null,
        )
      : null;

  // Arriving from a job's Quick Build, Quotes or Bidding tab, the back button
  // returns there instead of to the global quotes list.
  const backTarget = initialJob
    ? sheetLines
      ? {
          href: jobQuickBuildLinks(initialJob.id).edit(initialJob.id, sheetIds),
          label: `Back to Job ${initialJob.jobNumber}`,
        }
      : {
          href: `/jobs/${initialJob.id}?tab=${bidderId ? "bidding" : "quotes"}`,
          label: `Back to Job ${initialJob.jobNumber}`,
        }
    : { href: "/quotes", label: "Back to Quotes" };

  return (
    <DashboardShell
      title="New Quote"
      width="full"
    >
      <div>
        <QuoteForm
          backHref={backTarget.href}
          backLabel={backTarget.label}
          initialCustomer={initialCustomer}
          initialJob={initialJob}
          initialCustomerId={customerId}
          initialJobBidderId={bidderId}
          initialLineItems={sheetLines?.lineItems}
          initialLinesNote={
            sheetLines && initialJob
              ? quoteFromSheetsNotes(sheetLines, initialJob.jobNumber)
              : null
          }
          serviceOptions={serviceOptions}
          priceLists={priceLists}
          discountPricing={discountPricing}
          ringBuilderConfig={appSettings.ringBuilderConfig}
          ringSlabProducts={ringSlabProducts}
          pipeProducts={pipeProducts}
          taxonomy={taxonomy}
          quoteDefaults={{
            defaultTaxRate: appSettings.defaultTaxRate,
            defaultLeadTime: appSettings.defaultLeadTime,
            defaultExpirationDate: toLocalDayInput(defaultExpiration),
            estimators: appSettings.estimators,
            paymentTerms: appSettings.paymentTerms,
            defaultEstimator: user.displayName,
          }}
        />
      </div>
    </DashboardShell>
  );
}
