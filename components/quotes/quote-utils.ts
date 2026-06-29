import {
  computeLineItemTotal,
  computeQuotePreviewTotals,
} from "@/lib/quotes/money-rules";
import { formatUsd, formatWeightLb, formatYards } from "@/lib/format";

export * from "@/lib/quotes/types";
export * from "@/lib/quotes/constants";

export const quoteInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export const quoteReadOnlyClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 shadow-sm";

export const quoteCompactInputClassName =
  "block w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm";

export const quoteDescriptionTextareaClassName =
  "min-w-[18rem] w-full resize-y rounded border border-slate-200 bg-white px-2 py-1.5 text-sm leading-snug text-slate-900 shadow-sm whitespace-pre-wrap";

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
) {
  return contacts.find((contact) => contact.isPrimary) ?? contacts[0] ?? null;
}

export function getLineItemTotal(
  line: import("@/lib/quotes/types").EditableQuoteLineItem,
): number {
  if (line.type === "CATEGORY") {
    return 0;
  }
  return computeLineItemTotal(
    parseQuoteNumber(line.qty),
    parseQuoteNumber(line.unitPrice),
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
      unitPrice: parseQuoteNumber(line.unitPrice),
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
