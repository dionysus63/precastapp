import {
  invoiceStatusLabel,
  invoiceStatusVariant,
  isUnpaidInvoiceStatus,
} from "@/lib/invoice-status";

export type InvoiceDetailView = {
  id: string;
  invoiceNumber: string;
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  statusVariant: "success" | "info" | "warning" | "neutral" | "default" | "danger";
  /** One short line under the status, e.g. "Price needed on 1 line". */
  statusDetail: string;
  /** Lines an unpaid invoice is still waiting on a price for. */
  priceNeededCount: number;
  customerName: string;
  projectName: string;
  jobNumber: string;
  ticketNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  discountAmount: string;
  deliveryAmount: string;
  salesTax: string;
  total: string;
  taxRate: string;
  lineItems: {
    id: string;
    lineNumber: number;
    itemCode: string;
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    total: string;
    needsPrice: boolean;
  }[];
};

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function formatMoney(value: { toString(): string }): string {
  const amount = Number(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function statusDetail(status: string, priceNeededCount: number): string {
  if (status === "PAID") return "Paid in full";
  if (status === "VOID") return "Voided, not billed";
  if (!isUnpaidInvoiceStatus(status)) return status;
  return priceNeededCount > 0
    ? `Price needed on ${priceNeededCount} line${priceNeededCount === 1 ? "" : "s"}`
    : "Not paid yet";
}

export function mapDbInvoiceToDetailView(invoice: {
  id: string;
  invoiceNumber: string;
  status: string;
  customerName: string;
  projectName: string;
  jobNumber: string | null;
  subtotal: { toString(): string };
  discountAmount: { toString(): string };
  deliveryAmount: { toString(): string };
  salesTax: { toString(): string };
  total: { toString(): string };
  taxRate: { toString(): string };
  invoiceDate: Date | null;
  dueDate: Date | null;
  deliveryTicket: { ticketNumber: string | null };
  lineItems: {
    id: string;
    lineNumber: number;
    itemCode: string;
    description: string | null;
    quantity: { toString(): string };
    unit: string;
    unitPrice: { toString(): string };
    total: { toString(): string };
    needsPrice: boolean;
  }[];
}): InvoiceDetailView {
  // Only an unpaid invoice is still waiting for someone to type a price (the
  // banner, the status line, Mark paid). The lines themselves show what the
  // printed invoice shows whatever the status, e.g. on a voided invoice.
  const priceNeededCount = isUnpaidInvoiceStatus(invoice.status)
    ? invoice.lineItems.filter((line) => line.needsPrice).length
    : 0;
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    title: `Invoice ${invoice.invoiceNumber}`,
    subtitle: `${invoice.projectName} — ${invoice.customerName}`,
    status: invoice.status,
    statusLabel: invoiceStatusLabel(invoice.status),
    statusVariant: invoiceStatusVariant(invoice.status),
    statusDetail: statusDetail(invoice.status, priceNeededCount),
    priceNeededCount,
    customerName: invoice.customerName,
    projectName: invoice.projectName,
    jobNumber: invoice.jobNumber ?? "—",
    ticketNumber: invoice.deliveryTicket.ticketNumber ?? "—",
    invoiceDate: formatDate(invoice.invoiceDate),
    dueDate: formatDate(invoice.dueDate),
    subtotal: formatMoney(invoice.subtotal),
    discountAmount: formatMoney(invoice.discountAmount),
    deliveryAmount: formatMoney(invoice.deliveryAmount),
    salesTax: formatMoney(invoice.salesTax),
    total: formatMoney(invoice.total),
    taxRate: `${Number(invoice.taxRate).toFixed(2)}%`,
    lineItems: invoice.lineItems.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      itemCode: line.itemCode,
      description: line.description ?? "—",
      quantity: line.quantity.toString(),
      unit: line.unit,
      unitPrice: formatMoney(line.unitPrice),
      total: formatMoney(line.total),
      needsPrice: line.needsPrice,
    })),
  };
}
