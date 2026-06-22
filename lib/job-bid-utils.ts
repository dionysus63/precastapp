import type { QuoteStatus } from "@/components/quotes/quote-utils";

export const AWARDABLE_QUOTE_STATUSES: QuoteStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "SENT",
  "REVISED",
];

export const REMOVABLE_BIDDER_QUOTE_STATUSES: QuoteStatus[] = [
  "LOST",
  "LOST_BC",
  "CANCELLED",
  "EXPIRED",
];

export function isAwardableQuoteStatus(status: string): status is QuoteStatus {
  return AWARDABLE_QUOTE_STATUSES.includes(status as QuoteStatus);
}

export function isRemovableBidderQuoteStatus(status: string): status is QuoteStatus {
  return REMOVABLE_BIDDER_QUOTE_STATUSES.includes(status as QuoteStatus);
}
