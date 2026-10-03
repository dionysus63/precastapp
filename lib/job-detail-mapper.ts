import type {
  DeliveryTicket,
  Invoice,
  Job,
  JobStructure,
  Quote,
} from "@/app/generated/prisma/client";
import {
  jobStatusLabels,
  type JobDetailView,
  type JobInvoiceableDelivery,
  type JobRelatedDelivery,
  type JobRelatedInvoice,
  type JobRelatedQuote,
  type JobRelatedStructure,
  type JobStatusVariant,
} from "@/components/jobs/job-utils";
import { quoteStatusLabels, type QuoteStatus } from "@/components/quotes/quote-utils";
import {
  deliveryTicketStatusLabels,
  type DeliveryTicketStatus,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import {
  structureStatusOptions,
} from "@/components/structures/structure-utils";
import { mapStructureForJobList } from "@/lib/job-structure-detail-mapper";

type DecimalLike = { toString(): string };

export type JobWithRelations = Job & {
  quotes: Quote[];
  deliveryTickets: (DeliveryTicket & { invoice?: { id: string } | null })[];
  jobStructures: (JobStructure & { _count?: { documents: number } })[];
  invoices: (Invoice & { deliveryTicket?: { ticketNumber: string } | null })[];
};

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatCurrency(value: DecimalLike | null | undefined): string {
  const amount = value == null ? 0 : Number.parseFloat(value.toString());
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function jobStatusVariant(status: string): JobStatusVariant {
  switch (status) {
    case "ACTIVE":
    case "AWARDED":
    case "COMPLETE":
      return "success";
    case "QUOTING":
    case "SUBMITTED":
    case "LEAD":
      return "info";
    case "ON_HOLD":
      return "warning";
    case "LOST":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

function quoteStatusVariant(status: string): JobStatusVariant {
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
      return "danger";
    default:
      return "default";
  }
}

function deliveryStatusVariant(status: string): JobStatusVariant {
  switch (status) {
    case "DELIVERED":
      return "success";
    case "SCHEDULED":
    case "IN_TRANSIT":
      return "info";
    case "LOADING":
      return "warning";
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

function invoiceStatusVariant(status: string): JobStatusVariant {
  switch (status) {
    case "PAID":
      return "success";
    case "SENT":
      return "info";
    case "VOID":
      return "neutral";
    default:
      return "default";
  }
}

function formatProjectAddress(job: Job): string {
  const parts = [
    job.projectAddress,
    [job.city, job.state].filter(Boolean).join(", "),
    job.zip,
  ].filter((part) => part && part.trim() !== "");

  return parts.join(", ") || "—";
}

function mapQuote(quote: Quote): JobRelatedQuote {
  const status = quote.status as QuoteStatus;
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    projectName: quote.projectName,
    statusLabel: quoteStatusLabels[status] ?? quote.status,
    statusVariant: quoteStatusVariant(quote.status),
    total: formatCurrency(quote.total),
    lastUpdated: formatDate(quote.updatedAt),
  };
}

function mapDelivery(ticket: DeliveryTicket): JobRelatedDelivery {
  const status = ticket.status as DeliveryTicketStatus;
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    projectName: ticket.projectName,
    statusLabel: deliveryTicketStatusLabels[status] ?? ticket.status,
    statusVariant: deliveryStatusVariant(ticket.status),
    deliveryDate: formatDate(ticket.deliveryDate),
    lastUpdated: formatDate(ticket.updatedAt),
  };
}

function mapStructure(
  structure: JobStructure & { _count?: { documents: number } },
): JobRelatedStructure {
  return mapStructureForJobList(structure);
}

function mapInvoice(
  invoice: Invoice & { deliveryTicket?: { ticketNumber: string } | null },
): JobRelatedInvoice {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    ticketNumber: invoice.deliveryTicket?.ticketNumber ?? "—",
    statusLabel: invoice.status.replace(/_/g, " "),
    statusVariant: invoiceStatusVariant(invoice.status),
    total: formatCurrency(invoice.total),
    invoiceDate: formatDate(invoice.invoiceDate),
  };
}

export function mapJobToDetailView(job: JobWithRelations): JobDetailView {
  const relatedQuotes = job.quotes.map(mapQuote);
  const relatedDeliveries = job.deliveryTickets.map(mapDelivery);
  const relatedStructures = job.jobStructures.map(mapStructure);
  const relatedInvoices = job.invoices.map(mapInvoice);

  const invoiceableDeliveries: JobInvoiceableDelivery[] = job.deliveryTickets
    .filter((ticket) => ticket.status === "DELIVERED" && !ticket.invoice)
    .map((ticket) => ({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      projectName: ticket.projectName,
      deliveryDate: formatDate(ticket.deliveryDate),
    }));

  const totalQuoted = job.quotes.reduce(
    (sum, quote) => sum + Number.parseFloat(quote.total.toString() || "0"),
    0,
  );
  const wonQuoted = job.quotes
    .filter((quote) => quote.status === "WON")
    .reduce(
      (sum, quote) => sum + Number.parseFloat(quote.total.toString() || "0"),
      0,
    );
  const invoicedTotal = job.invoices.reduce(
    (sum, invoice) => sum + Number.parseFloat(invoice.total.toString() || "0"),
    0,
  );

  const structureStatusBreakdown = structureStatusOptions
    .map((option) => ({
      label: option.label,
      count: job.jobStructures.filter(
        (structure) => structure.status === option.value,
      ).length,
    }))
    .filter((entry) => entry.count > 0);

  const shippedStructures = job.jobStructures.filter(
    (structure) => structure.status === "SHIPPED",
  ).length;

  const stats: JobDetailView["stats"] = [
    {
      label: "Quotes",
      value: String(job.quotes.length),
      detail: `${formatCurrency(totalQuoted)} quoted`,
    },
    {
      label: "Won Value",
      value: formatCurrency(wonQuoted),
      detail: `${job.quotes.filter((q) => q.status === "WON").length} won`,
    },
    {
      label: "Structures",
      value: String(job.jobStructures.length),
      detail: `${shippedStructures} shipped`,
    },
    {
      label: "Deliveries",
      value: String(job.deliveryTickets.length),
      detail: `${
        job.deliveryTickets.filter((t) => t.status === "DELIVERED").length
      } delivered`,
    },
    {
      label: "Invoices",
      value: String(job.invoices.length),
      detail: `${formatCurrency(invoicedTotal)} invoiced`,
    },
  ];

  return {
    id: job.id,
    jobNumber: job.jobNumber,
    projectName: job.projectName,
    customer: job.customerName,
    customerId: job.customerId,
    status: jobStatusLabels[job.status] ?? job.status,
    statusVariant: jobStatusVariant(job.status),
    year: job.year,
    projectAddress: formatProjectAddress(job),
    contactName: job.contactName ?? "—",
    contactEmail: job.contactEmail ?? "—",
    contactPhone: job.contactPhone ?? "—",
    bidDate: formatDate(job.bidDate),
    awardedDate: formatDate(job.awardedDate),
    folderPath: job.folderPath,
    notes: job.notes ?? "—",
    createdAt: formatDate(job.createdAt),
    updatedAt: formatDate(job.updatedAt),
    stats,
    structureStatusBreakdown,
    relatedQuotes,
    relatedDeliveries,
    relatedStructures,
    relatedInvoices,
    invoiceableDeliveries,
  };
}
