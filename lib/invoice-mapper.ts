export type InvoiceDetailView = {
  id: string;
  invoiceNumber: string;
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  statusVariant: "success" | "info" | "warning" | "neutral" | "default";
  customerName: string;
  projectName: string;
  jobNumber: string;
  ticketNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
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

function statusVariant(status: string): InvoiceDetailView["statusVariant"] {
  if (status === "PAID") return "success";
  if (status === "SENT") return "info";
  if (status === "VOID") return "neutral";
  return "default";
}

export function mapDbInvoiceToDetailView(invoice: {
  id: string;
  invoiceNumber: string;
  status: string;
  customerName: string;
  projectName: string;
  jobNumber: string | null;
  subtotal: { toString(): string };
  salesTax: { toString(): string };
  total: { toString(): string };
  taxRate: { toString(): string };
  invoiceDate: Date | null;
  dueDate: Date | null;
  deliveryTicket: { ticketNumber: string };
  lineItems: {
    id: string;
    lineNumber: number;
    itemCode: string;
    description: string | null;
    quantity: { toString(): string };
    unit: string;
    unitPrice: { toString(): string };
    total: { toString(): string };
  }[];
}): InvoiceDetailView {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    title: `Invoice ${invoice.invoiceNumber}`,
    subtitle: `${invoice.projectName} — ${invoice.customerName}`,
    status: invoice.status,
    statusLabel: invoice.status.replace(/_/g, " "),
    statusVariant: statusVariant(invoice.status),
    customerName: invoice.customerName,
    projectName: invoice.projectName,
    jobNumber: invoice.jobNumber ?? "—",
    ticketNumber: invoice.deliveryTicket.ticketNumber,
    invoiceDate: formatDate(invoice.invoiceDate),
    dueDate: formatDate(invoice.dueDate),
    subtotal: formatMoney(invoice.subtotal),
    salesTax: formatMoney(invoice.salesTax),
    total: formatMoney(invoice.total),
    taxRate: `${(Number(invoice.taxRate) * 100).toFixed(2)}%`,
    lineItems: invoice.lineItems.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      itemCode: line.itemCode,
      description: line.description ?? "—",
      quantity: line.quantity.toString(),
      unit: line.unit,
      unitPrice: formatMoney(line.unitPrice),
      total: formatMoney(line.total),
    })),
  };
}
