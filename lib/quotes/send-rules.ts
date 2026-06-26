import type { QuoteStatus } from "@/lib/quotes/types";

const SENDABLE_QUOTE_STATUSES = new Set<QuoteStatus>([
  "DRAFT",
  "IN_REVIEW",
  "SENT",
]);

export function canSendQuote(
  status: QuoteStatus,
  supersededBy: { id: string } | null,
): boolean {
  if (supersededBy) {
    return false;
  }

  return SENDABLE_QUOTE_STATUSES.has(status);
}
