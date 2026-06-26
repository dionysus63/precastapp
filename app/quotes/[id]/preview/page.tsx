import { notFound } from "next/navigation";
import { QuotePreviewContent } from "@/components/quotes/quote-preview-content";
import { canEditQuote } from "@/lib/quotes/edit-rules";
import { canSendQuote } from "@/lib/quotes/send-rules";
import { withDatabaseRetry } from "@/lib/prisma";
import type { QuoteStatus } from "@/app/generated/prisma/client";

type QuotePreviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuotePreviewPage({ params }: QuotePreviewPageProps) {
  const { id } = await params;

  const quote = await withDatabaseRetry((prisma) =>
    prisma.quote.findUnique({
      where: { id },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        originalQuoteId: true,
        revisionNumber: true,
        projectName: true,
        contactName: true,
        contactEmail: true,
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

  const status = quote.status as QuoteStatus;

  return (
    <QuotePreviewContent
      quoteId={quote.id}
      quoteNumber={quote.quoteNumber}
      canEdit={canEditQuote(status, supersededBy)}
      canSend={canSendQuote(status, supersededBy)}
      contactEmail={quote.contactEmail?.trim() ?? ""}
      contactName={quote.contactName?.trim() ?? ""}
      projectName={quote.projectName}
    />
  );
}
