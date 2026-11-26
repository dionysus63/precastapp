import {
  computeLineItemTotal,
  computeQuotePreviewTotals,
} from "@/lib/quotes/money-rules";
import { formatUsd, formatWeightLb, formatYards } from "@/lib/format";
import { isNonBillableLineItem } from "@/lib/quotes/constants";
import {
  netUnitPrice,
  normalizeDiscountPercent,
} from "@/lib/pricing/line-discount";

export * from "@/lib/quotes/types";
export * from "@/lib/quotes/constants";

export const quoteInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export const quoteReadOnlyClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 shadow-sm";

export const quoteCompactInputClassName =
  "block w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm";

export function parseQuoteNumber(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatQuoteCurrency(value: number): string {
  return formatUsd(value);
}

export function formatQuoteWeight(value: number): string {
  return formatWeightLb(value);
}

export function formatQuoteYards(value: number): string {
  return formatYards(value);
}

export function pickDefaultCustomerContact(
  contacts: import("@/lib/quotes/types").QuoteFormCustomerContactOption[],
  estimatingContactId?: string | null,
) {
  // Quotes go to whoever prices work: estimating default -> Main -> first.
  return (
    (estimatingContactId
      ? contacts.find((contact) => contact.id === estimatingContactId)
      : null) ??
    contacts.find((contact) => contact.isPrimary) ??
    contacts[0] ??
    null
  );
}

/** A line's discount in percent; 0 for none. */
export function getLineDiscountPercent(
  line: import("@/lib/quotes/types").EditableQuoteLineItem,
): number {
  if (isNonBillableLineItem(line.type)) {
    return 0;
  }
  return normalizeDiscountPercent(line.discountPercent);
}

/** What a line bills at each: its list price less its discount. */
export function getLineNetUnitPrice(
  line: import("@/lib/quotes/types").EditableQuoteLineItem,
): number {
  return netUnitPrice(
    parseQuoteNumber(line.unitPrice),
    getLineDiscountPercent(line),
  );
}

export function getLineItemTotal(
  line: import("@/lib/quotes/types").EditableQuoteLineItem,
): number {
  if (isNonBillableLineItem(line.type)) {
    return 0;
  }
  return computeLineItemTotal(
    parseQuoteNumber(line.qty),
    getLineNetUnitPrice(line),
  );
}

export function calculateQuoteTotals(
  lineItems: import("@/lib/quotes/types").EditableQuoteLineItem[],
  taxRatePercent: number,
) {
  const preview = computeQuotePreviewTotals(
    lineItems.map((line) => ({
      lineType: line.type,
      itemCode: line.item,
      description: line.description,
      quantity: parseQuoteNumber(line.qty),
      unitPrice: getLineNetUnitPrice(line),
      taxable: line.taxable,
      weight: line.weight.trim() ? parseQuoteNumber(line.weight) : null,
      yards: line.yards.trim() ? parseQuoteNumber(line.yards) : null,
    })),
    taxRatePercent,
  );

  return {
    subtotal: preview.subtotal,
    discount: preview.discount,
    delivery: preview.delivery,
    taxableAmount: preview.taxableAmount,
    salesTax: preview.salesTax,
    total: preview.total,
    totalWeight: preview.totalWeight,
    totalYards: preview.totalYards,
  };
}
