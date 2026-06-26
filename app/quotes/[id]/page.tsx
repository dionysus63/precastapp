import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { QuoteDetailContent } from "@/components/quotes/quote-detail-content";
import { mapQuoteToDetailView } from "@/lib/quote-mapper";
import { withDatabaseRetry } from "@/lib/prisma";

type QuoteDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuoteDetailPage({ params }: QuoteDetailPageProps) {
  const { id } = await params;

  const quote = await withDatabaseRetry((prisma) =>
    prisma.quote.findUnique({
      where: { id },
      include: {
        jobBidder: {
          select: { customer: { select: { name: true } } },
        },
        lineItems: {
          orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
          include: {
            product: {
              include: {
                documents: {
                  where: {
                    documentType: { in: ["GENERIC_SUBMITTAL"] },
                  },
                },
              },
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
  const revisionFamily = await withDatabaseRetry((prisma) =>
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
  );

  const detail = mapQuoteToDetailView({ ...quote, revisionFamily });

  return (
    <DashboardShell title={detail.title} subtitle={detail.subtitle}>
      <QuoteDetailContent quote={detail} />
    </DashboardShell>
  );
}
