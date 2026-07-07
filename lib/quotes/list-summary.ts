import type { QuoteStatus } from "@/app/generated/prisma/client";

const OPEN_STATUSES: QuoteStatus[] = ["DRAFT", "IN_REVIEW", "SENT", "REVISED"];
const CLOSED_STATUSES: QuoteStatus[] = [
  "LOST",
  "LOST_BC",
  "EXPIRED",
  "CANCELLED",
];

export type QuoteStatTile = {
  label: string;
  value: string;
  detail: string | null;
  href: string;
  tone: "default" | "warning" | "success";
};

/** Compact dollar figure for the stat strip ($1.3M, $48K). */
function formatUsdCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Clickable stat tiles for the quotes list header — each href applies its filter. */
export function buildQuoteStatTiles(input: {
  openQuotesCount: number;
  dueThisWeekCount: number;
  awaitingCustomerCount: number;
  wonThisMonthCount: number;
  wonThisMonthTotal: number;
  openQuotesTotal: number;
}): QuoteStatTile[] {
  return [
    {
      label: "Open Quotes",
      value: String(input.openQuotesCount),
      detail: `${formatUsdCompact(input.openQuotesTotal)} open value`,
      href: "/quotes",
      tone: "default",
    },
    {
      label: "Due This Week",
      value: String(input.dueThisWeekCount),
      detail: "bid due within 7 days",
      href: "/quotes?due=Due%20This%20Week",
      tone: "warning",
    },
    {
      label: "Awaiting Customer",
      value: String(input.awaitingCustomerCount),
      detail: "sent, pending response",
      href: "/quotes?status=SENT",
      tone: "default",
    },
    {
      label: "Won This Month",
      value: String(input.wonThisMonthCount),
      detail: `${formatUsdCompact(input.wonThisMonthTotal)} awarded`,
      href: "/quotes?status=WON",
      tone: "success",
    },
  ];
}

export { OPEN_STATUSES, CLOSED_STATUSES };
