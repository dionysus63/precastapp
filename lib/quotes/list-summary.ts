import type { QuoteStatus } from "@/app/generated/prisma/client";
import { formatUsd } from "@/lib/format";
import { quoteStatusLabels } from "@/lib/quotes/constants";
import type { QuoteActivityItem } from "@/lib/quotes/types";

export type QuoteSummaryCard = {
  label: string;
  value: string;
  detail: string;
  accent: "sky" | "emerald" | "amber" | "rose";
};

const OPEN_STATUSES: QuoteStatus[] = ["DRAFT", "IN_REVIEW", "SENT", "REVISED"];

export function buildQuoteSummaryCards(input: {
  openQuotesCount: number;
  dueThisWeekCount: number;
  awaitingCustomerCount: number;
  wonThisMonthCount: number;
  wonThisMonthTotal: number;
  openQuotesTotal: number;
}): QuoteSummaryCard[] {
  return [
    {
      label: "Open Quotes",
      value: String(input.openQuotesCount),
      detail: "Draft, in review, sent, or revised",
      accent: "sky",
    },
    {
      label: "Quotes Due This Week",
      value: String(input.dueThisWeekCount),
      detail: "Bid due within 7 days",
      accent: "amber",
    },
    {
      label: "Awaiting Customer",
      value: String(input.awaitingCustomerCount),
      detail: "Sent and pending response",
      accent: "rose",
    },
    {
      label: "Won This Month",
      value: String(input.wonThisMonthCount),
      detail: `${formatUsd(input.wonThisMonthTotal)} awarded`,
      accent: "emerald",
    },
    {
      label: "Total Open Value",
      value: formatUsd(input.openQuotesTotal),
      detail: "Across open quotes",
      accent: "sky",
    },
  ];
}

export function buildRecentQuoteActivity(
  quotes: {
    id: string;
    quoteNumber: string;
    projectName: string;
    customerName: string;
    status: QuoteStatus;
    updatedAt: Date;
  }[],
): QuoteActivityItem[] {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return quotes.map((quote) => {
    const statusLabel = quoteStatusLabels[quote.status as keyof typeof quoteStatusLabels];
    const message =
      quote.status === "DRAFT"
        ? `${quote.quoteNumber} saved as ${statusLabel} for ${quote.projectName}`
        : `${quote.quoteNumber} marked as ${statusLabel} — ${quote.customerName}`;

    return {
      id: quote.id,
      message,
      timestamp: formatter.format(quote.updatedAt),
    };
  });
}

export { OPEN_STATUSES };
