import type { QuoteStatus } from "@/lib/quotes/types";

// SENT is deliberately editable-in-place (the detail page puts a confirm
// dialog in front of it): small corrections shouldn't force a revision.
// Revising is still the way to keep a record of what the customer received.
const EDITABLE_QUOTE_STATUSES = new Set<QuoteStatus>([
  "DRAFT",
  "IN_REVIEW",
  "SENT",
]);

export function canEditQuote(
  status: QuoteStatus,
  supersededBy: { id: string } | null,
): boolean {
  if (supersededBy) {
    return false;
  }

  return EDITABLE_QUOTE_STATUSES.has(status);
}
