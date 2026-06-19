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
        lineItems: {
          orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }],
        },
      },
    }),
  );

  if (!quote) {
    notFound();
  }

  const detail = mapQuoteToDetailView(quote);

  return (
    <DashboardShell title={detail.title} subtitle={detail.subtitle}>
      <QuoteDetailContent quote={detail} />
    </DashboardShell>
  );
}
