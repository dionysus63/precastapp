import type { QuoteDetailView } from "@/components/quotes/quote-utils";
import {
  type QuoteRow,
  type QuoteStatus,
  type QuoteType,
  quoteLineItemTypeLabels,
  quoteStatusLabels,
  quoteTypeLabels,
} from "@/components/quotes/quote-utils";

export type QuoteRecord = {
  id: string;
  quoteNumber: string;
  revisionNumber: number;
  originalQuoteId: string | null;
  jobId: string | null;
  customerId: string | null;
  jobNumber: string | null;
  customerName: string;
  projectName: string;
  projectAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  quoteType: string;
  estimator: string | null;
  quoteDate: Date | null;
  bidDueDate: Date | null;
  expirationDate: Date | null;
  customerPO: string | null;
  subtotal: { toString(): string };
  discountAmount: { toString(): string };
  deliveryAmount: { toString(): string };
  taxableAmount: { toString(): string };
  taxRate: { toString(): string };
  salesTax: { toString(): string };
  total: { toString(): string };
  totalWeight: { toString(): string };
  totalYards: { toString(): string };
  internalNotes: string | null;
  customerNotes: string | null;
  termsAndConditions: string | null;
  leadTime: string | null;
  deliveryNotes: string | null;
  priceListId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QuoteLineItemRecord = {
  id: string;
  lineNumber: number;
  lineType: string;
  productId: string | null;
  itemCode: string;
  description: string | null;
  quantity: { toString(): string };
  unit: string;
  unitPrice: { toString(): string };
  weight: { toString(): string } | null;
  yards: { toString(): string } | null;
  taxable: boolean;
  total: { toString(): string };
  statusNote: string | null;
  notes: string | null;
};

export type QuoteDetailRecord = QuoteRecord & {
  lineItems: QuoteLineItemRecord[];
};

function statusVariant(
  status: string,
): QuoteRow["statusVariant"] {
  switch (status) {
    case "WON":
      return "success";
    case "SENT":
    case "IN_REVIEW":
      return "info";
    case "REVISED":
      return "warning";
    case "LOST":
    case "EXPIRED":
    case "CANCELLED":
      return "neutral";
    default:
      return "default";
  }
}

function formatQuoteDate(date: Date | null | undefined) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatQuoteDateLong(date: Date | null | undefined) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatCurrency(value: { toString(): string } | number) {
  const amount =
    typeof value === "number" ? value : Number.parseFloat(value.toString());
  if (!Number.isFinite(amount)) {
    return "—";
  }

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatWeight(value: { toString(): string } | number | null) {
  if (value === null) {
    return "—";
  }

  const amount =
    typeof value === "number" ? value : Number.parseFloat(value.toString());
  if (!Number.isFinite(amount) || amount <= 0) {
    return "—";
  }

  return `${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} lb`;
}

function formatYards(value: { toString(): string } | number | null) {
  if (value === null) {
    return "—";
  }

  const amount =
    typeof value === "number" ? value : Number.parseFloat(value.toString());
  if (!Number.isFinite(amount) || amount <= 0) {
    return "—";
  }

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value: { toString(): string }) {
  const amount = Number.parseFloat(value.toString());
  if (!Number.isFinite(amount)) {
    return value.toString();
  }

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function formatLineNotes(
  statusNote: string | null | undefined,
  notes: string | null | undefined,
) {
  const parts = [statusNote, notes].filter(
    (part): part is string => Boolean(part?.trim()),
  );

  return parts.length > 0 ? parts.join(" · ") : "—";
}

function deriveOriginalQuoteNumber(quote: QuoteDetailRecord) {
  if (quote.revisionNumber === 0) {
    return quote.quoteNumber;
  }

  return quote.quoteNumber.replace(/-R\d+(-\d+)?$/, "-R0");
}

function mapLineTypeLabel(lineType: string) {
  return (
    quoteLineItemTypeLabels[lineType as keyof typeof quoteLineItemTypeLabels] ??
    lineType
  );
}

export function mapQuoteToRow(quote: QuoteRecord): QuoteRow {
  const status = quote.status as QuoteStatus;
  const quoteType = quote.quoteType as QuoteType;

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    revision: `R${quote.revisionNumber}`,
    jobNumber: quote.jobNumber ?? "—",
    projectName: quote.projectName,
    customer: quote.customerName,
    quoteType,
    quoteTypeLabel: quoteTypeLabels[quoteType] ?? quote.quoteType,
    status,
    statusLabel: quoteStatusLabels[status] ?? quote.status,
    statusVariant: statusVariant(quote.status),
    bidDueDate: formatQuoteDate(quote.bidDueDate),
    total: formatCurrency(quote.total),
    estimator: quote.estimator ?? "—",
    lastUpdated: formatQuoteDateLong(quote.updatedAt),
    year: quote.quoteDate?.getFullYear() ?? quote.createdAt.getFullYear(),
  };
}

export function mapQuoteToDetailView(quote: QuoteDetailRecord): QuoteDetailView {
  const status = quote.status as QuoteStatus;
  const taxRateNumber = Number.parseFloat(quote.taxRate.toString());

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    originalQuote: deriveOriginalQuoteNumber(quote),
    title: `Quote ${quote.quoteNumber}`,
    subtitle: `${quote.projectName} — ${quote.customerName}`,
    status,
    statusLabel: quoteStatusLabels[status] ?? quote.status,
    statusVariant: statusVariant(quote.status),
    total: formatCurrency(quote.total),
    bidDueDate: formatQuoteDate(quote.bidDueDate),
    revision: `R${quote.revisionNumber}`,
    estimator: quote.estimator ?? "—",
    jobNumber: quote.jobNumber ?? "—",
    projectName: quote.projectName,
    projectAddress: quote.projectAddress?.trim() || "—",
    customer: quote.customerName,
    contactName: quote.contactName?.trim() || "—",
    contactEmail: quote.contactEmail?.trim() || "—",
    contactPhone: quote.contactPhone?.trim() || "—",
    quoteDate: formatQuoteDate(quote.quoteDate),
    expirationDate: formatQuoteDate(quote.expirationDate),
    priceList: "—",
    taxRate: `${Number.isFinite(taxRateNumber) ? taxRateNumber : 0}%`,
    customerPo: quote.customerPO?.trim() || "—",
    customerNotes: quote.customerNotes?.trim() || "—",
    internalNotes: quote.internalNotes?.trim() || "—",
    deliveryNotes: quote.deliveryNotes?.trim() || "—",
    leadTime: quote.leadTime?.trim() || "—",
    terms: quote.termsAndConditions?.trim() || "—",
    lineItems: quote.lineItems.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      type: line.lineType as QuoteDetailView["lineItems"][number]["type"],
      typeLabel: mapLineTypeLabel(line.lineType),
      item: line.itemCode,
      description: line.description?.trim() || "—",
      qty: formatQuantity(line.quantity),
      unit: line.unit,
      unitPrice: formatCurrency(line.unitPrice),
      weight: formatWeight(line.weight),
      yards: formatYards(line.yards),
      taxable: line.taxable,
      total: formatCurrency(line.total),
      statusNotes: formatLineNotes(line.statusNote, line.notes),
    })),
    summary: {
      subtotal: formatCurrency(quote.subtotal),
      discount: formatCurrency(quote.discountAmount),
      delivery: formatCurrency(quote.deliveryAmount),
      taxableAmount: formatCurrency(quote.taxableAmount),
      salesTax: formatCurrency(quote.salesTax),
      total: formatCurrency(quote.total),
      totalWeight: formatWeight(quote.totalWeight),
      totalYards: formatYards(quote.totalYards),
    },
    revisionHistory: [
      {
        id: "rev-created",
        label: `${quote.quoteNumber} created`,
      },
    ],
    relatedRecords: {
      jobNumber: quote.jobNumber ?? "—",
      customer: quote.customerName,
      structures: "Not linked",
      documents: "0",
      submittals: "Not generated",
      invoice: "Not created",
      deliveryTickets: "None",
    },
  };
}

export function mapProductToQuoteFormOption(product: {
  id: string;
  productCode: string;
  name: string;
  description: string | null;
  unit: string;
  defaultPrice: { toString(): string } | null;
  weight: { toString(): string } | null;
  yards: { toString(): string } | null;
  taxable: boolean;
}) {
  return {
    id: product.id,
    code: product.productCode,
    description: product.description?.trim() || product.name,
    unit: product.unit,
    unitPrice: product.defaultPrice
      ? Number.parseFloat(product.defaultPrice.toString())
      : 0,
    weightLb: product.weight
      ? Number.parseFloat(product.weight.toString())
      : 0,
    yards: product.yards ? Number.parseFloat(product.yards.toString()) : 0,
    taxable: product.taxable,
  };
}
