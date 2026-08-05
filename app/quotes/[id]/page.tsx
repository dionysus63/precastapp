import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { QuoteDetailContent } from "@/components/quotes/quote-detail-content";
import { mapQuoteToDetailView } from "@/lib/quote-mapper";
import { getAppSettings } from "@/lib/app-settings";
import { buildGalleyBreakdownViews } from "@/lib/galley-service";
import { buildQuoteAttachmentFilename } from "@/lib/quote-pdf-persist";
import { submittalProductInclude } from "@/lib/submittal-package";
import { withDatabaseRetry } from "@/lib/prisma";

type QuoteDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ send?: string }>;
};

export default async function QuoteDetailPage({
  params,
  searchParams,
}: QuoteDetailPageProps) {
  const { id } = await params;
  const { send } = await searchParams;

  const quote = await withDatabaseRetry((prisma) =>
    prisma.quote.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { displayName: true },
        },
        jobBidder: {
          select: { customer: { select: { name: true } } },
        },
        priceList: {
          select: { name: true },
        },
        lineItems: {
          orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
          include: {
            product: {
              include: submittalProductInclude,
            },
          },
        },
        jobStructures: {
          orderBy: { structureNumber: "asc" },
          include: {
            _count: { select: { documents: true } },
            job: { select: { id: true, folderPath: true } },
          },
        },
      },
    }),
  );

  if (!quote) {
    notFound();
  }

  const rootId = quote.originalQuoteId ?? quote.id;
  const groupRoot = quote.masterQuoteId ?? quote.id;

  // Independent of each other — run in parallel.
  const [revisionFamily, siblingQuotes] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.quote.findMany({
        where: {
          OR: [{ id: rootId }, { originalQuoteId: rootId }],
        },
        orderBy: { revisionNumber: "asc" },
        select: {
          id: true,
          quoteNumber: true,
          revisionNumber: true,
          status: true,
          createdAt: true,
        },
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.quote.findMany({
        where: {
          OR: [{ id: groupRoot }, { masterQuoteId: groupRoot }],
        },
        orderBy: [{ customerName: "asc" }],
        select: {
          id: true,
          customerName: true,
          quoteNumber: true,
          status: true,
          total: true,
        },
      }),
    ),
  ]);

  const detail = mapQuoteToDetailView(
    { ...quote, revisionFamily },
    siblingQuotes,
  );

  // Same contractor-facing name the emailed attachment uses.
  const pdfFileName = await withDatabaseRetry((prisma) =>
    buildQuoteAttachmentFilename(quote, `quote-${quote.quoteNumber}`, prisma),
  );
  const appSettings = await getAppSettings();
  const galleyBreakdowns = await withDatabaseRetry((prisma) =>
    buildGalleyBreakdownViews(prisma, quote),
  );

  return (
    <DashboardShell title={detail.title} subtitle={detail.subtitle}>
      <QuoteDetailContent
        quote={detail}
        pdfFileName={pdfFileName}
        autoOpenSend={send === "1"}
        defaultTaxRatePercent={appSettings.defaultTaxRate}
        galleyBreakdowns={galleyBreakdowns}
      />
    </DashboardShell>
  );
}
