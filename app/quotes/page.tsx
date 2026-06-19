import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { QuotesPageContent } from "@/components/quotes/quotes-page-content";
import { mapQuoteToRow } from "@/lib/quote-mapper";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function QuotesPage() {
  const quotes = await withDatabaseRetry((prisma) =>
    prisma.quote.findMany({
      orderBy: [{ updatedAt: "desc" }],
    }),
  );

  const rows = quotes.map(mapQuoteToRow);

  return (
    <DashboardShell
      title="Quotes"
      subtitle="Manage bids, revisions, and quote status."
    >
      <QuotesPageContent quotes={rows} />
    </DashboardShell>
  );
}
