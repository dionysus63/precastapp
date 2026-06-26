import type { QuoteStatus } from "@/lib/quotes/types";

const EDITABLE_QUOTE_STATUSES = new Set<QuoteStatus>(["DRAFT", "IN_REVIEW"]);

export function canEditQuote(
  status: QuoteStatus,
  supersededBy: { id: string } | null,
): boolean {
  if (supersededBy) {
    return false;
  }

  return EDITABLE_QUOTE_STATUSES.has(status);
}
