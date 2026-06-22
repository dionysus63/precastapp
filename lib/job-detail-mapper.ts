import type {
  Contact,
  Customer,
  DeliveryTicket,
  Invoice,
  Job,
  JobBidder,
  JobStructure,
  Quote,
} from "@/app/generated/prisma/client";
import {
  jobStatusLabels,
  type JobBidderContactOption,
  type JobBidderRow,
  type JobBiddingSummary,
  type JobDetailView,
  type JobInvoiceableDelivery,
  type JobMasterQuoteOption,
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
  quotes: (Quote & { _count?: { lineItems: number } })[];
  bidders: (JobBidder & {
    customer: Customer & { contacts: Contact[] };
    quotes: Quote[];
  })[];
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
    case "LOST_BC":
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
    customerName: quote.customerName,
    statusLabel: quoteStatusLabels[status] ?? quote.status,
    statusVariant: quoteStatusVariant(quote.status),
    total: formatCurrency(quote.total),
    lastUpdated: formatDate(quote.updatedAt),
  };
}

function mapBidderContact(contact: Contact): JobBidderContactOption {
  return {
    id: contact.id,
    name: contact.name,
    title: contact.title ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    isPrimary: contact.isPrimary,
  };
}

function defaultContactIdForBidder(contacts: JobBidderContactOption[]) {
  return (
    contacts.find((contact) => contact.isPrimary)?.id ??
    contacts[0]?.id ??
    null
  );
}

function mapBidder(
  bidder: JobBidder & {
    customer: Customer & { contacts: Contact[] };
    quotes: Quote[];
  },
): JobBidderRow {
  const quote = bidder.quotes[0] ?? null;
  const quoteStatus = quote ? (quote.status as QuoteStatus) : null;
  const contacts = bidder.customer.contacts.map(mapBidderContact);
  const defaultContactId = defaultContactIdForBidder(contacts);
  const selectedContact =
    contacts.find((contact) => contact.id === defaultContactId) ?? null;

  return {
    id: bidder.id,
    customerId: bidder.customerId,
    customerName: bidder.customer.name,
    contactName:
      quote?.contactName ??
      selectedContact?.name ??
      bidder.customer.primaryContactName ??
      "—",
    contactEmail:
      quote?.contactEmail ??
      selectedContact?.email ??
      bidder.customer.email ??
      "—",
    contactPhone:
      quote?.contactPhone ??
      selectedContact?.phone ??
      bidder.customer.phone ??
      "—",
    contacts,
    defaultContactId,
    isWinner: bidder.isWinner,
    quoteId: quote?.id ?? null,
    quoteNumber: quote?.quoteNumber ?? null,
    quoteStatus,
    quoteStatusLabel: quoteStatus
      ? (quoteStatusLabels[quoteStatus] ?? quote.status)
      : null,
    quoteStatusVariant: quote ? quoteStatusVariant(quote.status) : "neutral",
    sentAt: quote?.sentAt ? formatDate(quote.sentAt) : null,
  };
}

function buildBiddingSummary(
  job: Job,
  bidders: JobBidderRow[],
): JobBiddingSummary {
  const quotesSentCount = bidders.filter(
    (bidder) => bidder.sentAt && bidder.sentAt !== "—",
  ).length;
  const isAwarded = Boolean(job.awardedDate) || job.status === "AWARDED";
  const winner = bidders.find((bidder) => bidder.isWinner);

  let summaryText: string;
  if (isAwarded && winner) {
    summaryText = `Awarded to ${winner.customerName} on ${formatDate(job.awardedDate)}`;
  } else if (isAwarded && job.customerName) {
    summaryText = `Awarded to ${job.customerName} on ${formatDate(job.awardedDate)}`;
  } else if (bidders.length === 0) {
    summaryText = "No contractors on bid list yet";
  } else {
    summaryText = `${bidders.length} bidder${bidders.length === 1 ? "" : "s"} · ${quotesSentCount} quote${quotesSentCount === 1 ? "" : "s"} sent · Awaiting award`;
  }

  return {
    bidderCount: bidders.length,
    quotesSentCount,
    summaryText,
    isAwarded,
  };
}

const MASTER_QUOTE_STATUSES = new Set([
  "DRAFT",
  "IN_REVIEW",
  "SENT",
  "REVISED",
]);

function mapMasterQuoteOptions(
  quotes: (Quote & { _count?: { lineItems: number } })[],
): JobMasterQuoteOption[] {
  return quotes
    .filter(
      (quote) =>
        !quote.jobBidderId &&
        (quote._count?.lineItems ?? 0) > 0 &&
        MASTER_QUOTE_STATUSES.has(quote.status),
    )
    .map((quote) => ({
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      lineItemCount: quote._count?.lineItems ?? 0,
    }));
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
  const bidders = job.bidders.map(mapBidder);
  const biddingSummary = buildBiddingSummary(job, bidders);
  const masterQuoteOptions = mapMasterQuoteOptions(job.quotes);
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
    biddingSummary,
    bidders,
    masterQuoteOptions,
    relatedQuotes,
    relatedDeliveries,
    relatedStructures,
    relatedInvoices,
    invoiceableDeliveries,
  };
}
