import type { StatusVariant } from "@/lib/status-variants";

/**
 * Invoice status wording shared by every screen that shows one.
 *
 * There is no draft stage: an invoice is made open (SENT) the moment its
 * ticket is marked delivered, and stays editable until it is paid or voided.
 * DRAFT is the legacy status of invoices made before that change; wherever
 * one could still turn up it reads and behaves exactly like an open invoice.
 */
export const UNPAID_INVOICE_STATUSES = ["DRAFT", "SENT"] as const;

export function isUnpaidInvoiceStatus(status: string): boolean {
  return status === "DRAFT" || status === "SENT";
}

export function invoiceStatusLabel(status: string): string {
  if (isUnpaidInvoiceStatus(status)) return "Open";
  if (status === "PAID") return "Paid";
  if (status === "VOID") return "Void";
  return status.replace(/_/g, " ");
}

export function invoiceStatusVariant(status: string): StatusVariant {
  if (status === "PAID") return "success";
  if (isUnpaidInvoiceStatus(status)) return "info";
  if (status === "VOID") return "neutral";
  return "default";
}

/** The filter chips above the Invoices list, in display order. */
export const INVOICE_LIST_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "PRICE_NEEDED", label: "Price needed" },
  { value: "OPEN", label: "Open" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void" },
] as const;

export type InvoiceListFilter = (typeof INVOICE_LIST_FILTERS)[number]["value"];

export type InvoiceFilterCounts = Record<InvoiceListFilter, number>;

/** `?status=` on /invoices; anything unknown (or missing) shows every invoice. */
export function parseInvoiceListFilter(
  value: string | null | undefined,
): InvoiceListFilter {
  const match = INVOICE_LIST_FILTERS.find((filter) => filter.value === value);
  return match ? match.value : "ALL";
}
