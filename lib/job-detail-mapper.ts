import type {
  Contact,
  Customer,
  DeliveryTicket,
  DeliveryTicketLineItem,
  Invoice,
  Job,
  JobBidder,
  JobStructure,
  Quote,
} from "@/app/generated/prisma/client";
import {
  jobStatusLabels,
  type JobActivityItem,
  type JobAttentionItem,
  type JobBidderContactOption,
  type JobBidderRow,
  type JobBiddingSummary,
  type JobDeliveryLineItem,
  type JobDetailView,
  type JobInvoiceableDelivery,
  type JobMasterQuoteOption,
  type JobOverviewData,
  type JobRelatedDelivery,
  type JobRelatedInvoice,
  type JobRelatedQuote,
  type JobRelatedStructure,
  type JobStatusVariant,
} from "@/components/jobs/job-utils";
import { quoteStatusLabels, type QuoteStatus } from "@/components/quotes/quote-utils";
import { OPEN_STATUSES } from "@/lib/quotes/list-summary";
import { formatDateShort, formatUsd, formatWeightLb } from "@/lib/format";
import { jobStatusVariant, quoteStatusVariant } from "@/lib/status-variants";
import {
  deliveryTicketStatusLabels,
  type DeliveryTicketStatus,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import {
  structureStatusOptions,
} from "@/components/structures/structure-utils";
import { mapStructureForJobList } from "@/lib/job-structure-detail-mapper";

type DeliveryTicketLineItemSummary = Pick<
  DeliveryTicketLineItem,
  | "id"
  | "lineNumber"
  | "itemCode"
  | "description"
  | "quantity"
  | "unit"
  | "totalWeight"
  | "status"
  | "yardLocation"
>;

export type JobWithSummaryRelations = Job & {
  _count: {
    quotes: number;
    bidders: number;
    deliveryTickets: number;
    jobStructures: number;
    invoices: number;
  };
  quotes: Pick<Quote, "status" | "total">[];
  bidders: {
    isWinner: boolean;
    customer: { name: string };
    quotes: Pick<Quote, "sentAt">[];
  }[];
  deliveryTickets: Pick<DeliveryTicket, "status">[];
  jobStructures: Pick<JobStructure, "status">[];
  invoices: Pick<Invoice, "total">[];
};

export type JobBidderWithRelations = JobBidder & {
  customer: Customer & {
    contacts: Contact[];
    contactRoleDefaults: { role: string; contactId: string }[];
  };
  quotes: Quote[];
};

export type JobDeliveryTicketWithLineItems = DeliveryTicket & {
  lineItems?: DeliveryTicketLineItemSummary[];
};

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return "—";
  }
  return formatDateShort(date);
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

function mapQuote(quote: Quote & { masterQuoteId?: string | null }): JobRelatedQuote {
  const status = quote.status as QuoteStatus;
  const groupKey = quote.masterQuoteId ?? quote.id;
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    projectName: quote.projectName,
    scopeLabel: quote.scopeLabel?.trim() || null,
    customerName: quote.customerName,
    masterQuoteId: quote.masterQuoteId ?? null,
    groupKey,
    isMaster: !quote.masterQuoteId,
    statusLabel: quoteStatusLabels[status] ?? quote.status,
    statusVariant: quoteStatusVariant(quote.status),
    total: formatUsd(quote.total ?? 0),
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

function defaultContactIdForBidder(
  contacts: JobBidderContactOption[],
  estimatingDefaultId: string | null,
) {
  return (
    (estimatingDefaultId &&
      contacts.find((contact) => contact.id === estimatingDefaultId)?.id) ||
    (contacts.find((contact) => contact.isPrimary)?.id ??
      contacts[0]?.id ??
      null)
  );
}

function mapBidder(bidder: JobBidderWithRelations): JobBidderRow {
  const quote = bidder.quotes[0] ?? null;
  const quoteStatus = quote ? (quote.status as QuoteStatus) : null;
  const contacts = bidder.customer.contacts.map(mapBidderContact);
  // Bid invitations go to whoever prices work for the contractor.
  const estimatingDefaultId =
    bidder.customer.contactRoleDefaults.find((d) => d.role === "ESTIMATING")
      ?.contactId ?? null;
  const defaultContactId = defaultContactIdForBidder(
    contacts,
    estimatingDefaultId,
  );
  const selectedContact =
    contacts.find((contact) => contact.id === defaultContactId) ?? null;

  return {
    id: bidder.id,
    customerId: bidder.customerId,
    customerName: bidder.customer.name,
    contactName: quote?.contactName ?? selectedContact?.name ?? "—",
    contactEmail: quote?.contactEmail ?? selectedContact?.email ?? "—",
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

type JobBidderSummaryInput = {
  isWinner: boolean;
  customerName: string;
  hasSentQuote: boolean;
};

function buildBiddingSummary(
  job: Job,
  bidders: JobBidderSummaryInput[],
): JobBiddingSummary {
  const quotesSentCount = bidders.filter(
    (bidder) => bidder.hasSentQuote,
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

export function mapJobMasterQuoteOptions(
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
      scopeLabel: quote.scopeLabel?.trim() || null,
      lineItemCount: quote._count?.lineItems ?? 0,
    }));
}

function deliveryItemStatusVariant(status: string): JobStatusVariant {
  switch (status) {
    case "DELIVERED":
    case "LOADED":
    case "READY":
      return "success";
    case "LOADING":
      return "info";
    case "NOT_READY":
      return "warning";
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

function mapDeliveryLineItem(
  line: DeliveryTicketLineItemSummary,
): JobDeliveryLineItem {
  return {
    id: line.id,
    lineNumber: line.lineNumber,
    itemCode: line.itemCode,
    description: line.description ?? "—",
    quantity: Number(line.quantity).toLocaleString("en-US", {
      maximumFractionDigits: 4,
    }),
    unit: line.unit,
    totalWeight: formatWeightLb(line.totalWeight),
    yardLocation: line.yardLocation ?? "—",
    statusLabel: line.status.replace(/_/g, " "),
    statusVariant: deliveryItemStatusVariant(line.status),
  };
}

function mapDelivery(ticket: JobDeliveryTicketWithLineItems): JobRelatedDelivery {
  const status = ticket.status as DeliveryTicketStatus;
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    projectName: ticket.projectName,
    statusLabel: deliveryTicketStatusLabels[status] ?? ticket.status,
    statusVariant: deliveryStatusVariant(ticket.status),
    deliveryDate: formatDate(ticket.deliveryDate),
    lastUpdated: formatDate(ticket.updatedAt),
    lineItems: (ticket.lineItems ?? []).map(mapDeliveryLineItem),
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
    total: formatUsd(invoice.total),
    invoiceDate: formatDate(invoice.invoiceDate),
  };
}

export function mapJobQuotes(quotes: Quote[]): JobRelatedQuote[] {
  return quotes.map(mapQuote);
}

export function mapJobBidders(
  bidders: JobBidderWithRelations[],
): JobBidderRow[] {
  return bidders.map(mapBidder);
}

export function mapJobDeliveries(
  tickets: JobDeliveryTicketWithLineItems[],
): JobRelatedDelivery[] {
  return tickets.map(mapDelivery);
}

export function mapJobInvoiceableDeliveries(
  tickets: Pick<
    DeliveryTicket,
    "id" | "ticketNumber" | "projectName" | "deliveryDate"
  >[],
): JobInvoiceableDelivery[] {
  return tickets.map((ticket) => ({
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    projectName: ticket.projectName,
    deliveryDate: formatDate(ticket.deliveryDate),
  }));
}

export function mapJobStructures(
  structures: (JobStructure & { _count?: { documents: number } })[],
): JobRelatedStructure[] {
  return structures.map(mapStructure);
}

export function mapJobInvoices(
  invoices: (Invoice & { deliveryTicket?: { ticketNumber: string } | null })[],
): JobRelatedInvoice[] {
  return invoices.map(mapInvoice);
}

export function mapJobToDetailView(job: JobWithSummaryRelations): JobDetailView {
  const biddingSummary = buildBiddingSummary(
    job,
    job.bidders.map((bidder) => ({
      isWinner: bidder.isWinner,
      customerName: bidder.customer.name,
      hasSentQuote: Boolean(bidder.quotes[0]?.sentAt),
    })),
  );

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
      value: String(job._count.quotes),
      detail: `${formatUsd(totalQuoted)} quoted`,
    },
    {
      label: "Won Value",
      value: formatUsd(wonQuoted),
      detail: `${job.quotes.filter((q) => q.status === "WON").length} won`,
    },
    {
      label: "Structures",
      value: String(job._count.jobStructures),
      detail: `${shippedStructures} shipped`,
    },
    {
      label: "Deliveries",
      value: String(job._count.deliveryTickets),
      detail: `${
        job.deliveryTickets.filter((t) => t.status === "DELIVERED").length
      } delivered`,
    },
    {
      label: "Invoices",
      value: String(job._count.invoices),
      detail: `${formatUsd(invoicedTotal)} invoiced`,
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
    counts: {
      quotes: job._count.quotes,
      bidders: job._count.bidders,
      deliveries: job._count.deliveryTickets,
      structures: job._count.jobStructures,
      invoices: job._count.invoices,
    },
  };
}

const structureActivityStatusLabels: Record<string, string> =
  Object.fromEntries(
    structureStatusOptions.map((option) => [option.value, option.label]),
  );

function structureActivityVariant(status: string): JobStatusVariant {
  switch (status) {
    case "MADE":
    case "SHIPPED":
      return "success";
    case "APPROVED":
    case "IN_PRODUCTION":
      return "info";
    case "SUBMITTED":
      return "warning";
    default:
      return "neutral";
  }
}

export type JobOverviewRecords = {
  quotes: Pick<Quote, "id" | "quoteNumber" | "status" | "bidDueDate" | "updatedAt">[];
  deliveryTickets: (Pick<
    DeliveryTicket,
    "id" | "ticketNumber" | "status" | "updatedAt"
  > & { invoice: { id: string } | null })[];
  structures: Pick<
    JobStructure,
    "id" | "structureNumber" | "status" | "needsSubmittal" | "updatedAt"
  >[];
  invoices: Pick<Invoice, "id" | "invoiceNumber" | "status" | "updatedAt">[];
};

const IN_FLIGHT_TICKET_STATUSES = new Set(["SCHEDULED", "LOADING", "IN_TRANSIT"]);

/** Attention items + activity feed for the job overview tab. */
export function buildJobOverview(
  jobId: string,
  folderPath: string | null,
  records: JobOverviewRecords,
): JobOverviewData {
  const { quotes, deliveryTickets, structures, invoices } = records;

  const attentionItems: JobAttentionItem[] = [];
  const plural = (count: number, noun: string) =>
    `${count} ${noun}${count === 1 ? "" : "s"}`;

  const needSubmittal = structures.filter((s) => s.needsSubmittal).length;
  if (needSubmittal > 0) {
    attentionItems.push({
      key: "submittals",
      label: `${plural(needSubmittal, "structure")} need${needSubmittal === 1 ? "s" : ""} a submittal`,
      tab: "production",
      tone: "warning",
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const bidsDueSoon = quotes.filter(
    (quote) =>
      OPEN_STATUSES.includes(quote.status as QuoteStatus) &&
      quote.bidDueDate != null &&
      quote.bidDueDate <= weekEnd,
  ).length;
  if (bidsDueSoon > 0) {
    attentionItems.push({
      key: "bids-due",
      label: `${plural(bidsDueSoon, "open quote")} with a bid due soon or overdue`,
      tab: "quotes",
      tone: "danger",
    });
  }

  const awaitingCustomer = quotes.filter((q) => q.status === "SENT").length;
  if (awaitingCustomer > 0) {
    attentionItems.push({
      key: "awaiting-customer",
      label: `${plural(awaitingCustomer, "quote")} awaiting customer response`,
      tab: "quotes",
      tone: "info",
    });
  }

  const uninvoiced = deliveryTickets.filter(
    (t) => t.status === "DELIVERED" && !t.invoice,
  ).length;
  if (uninvoiced > 0) {
    attentionItems.push({
      key: "uninvoiced",
      label: `${plural(uninvoiced, "delivered load")} not invoiced yet`,
      tab: "invoices",
      tone: "danger",
    });
  }

  const inFlight = deliveryTickets.filter((t) =>
    IN_FLIGHT_TICKET_STATUSES.has(t.status),
  ).length;
  if (inFlight > 0) {
    attentionItems.push({
      key: "deliveries-in-flight",
      label: `${inFlight} ${inFlight === 1 ? "delivery" : "deliveries"} scheduled or on the road`,
      tab: "deliveries",
      tone: "info",
    });
  }

  if (!folderPath) {
    attentionItems.push({
      key: "no-folder",
      label: "Job folder hasn't been created yet",
      tab: "files",
      tone: "warning",
    });
  }

  const activity: (JobActivityItem & { sortDate: Date })[] = [
    ...quotes.map((quote) => ({
      key: `quote-${quote.id}`,
      typeLabel: "Quote",
      recordNumber: quote.quoteNumber,
      href: `/quotes/${quote.id}`,
      statusLabel:
        quoteStatusLabels[quote.status as QuoteStatus] ?? quote.status,
      statusVariant: quoteStatusVariant(quote.status),
      updated: formatDate(quote.updatedAt),
      sortDate: quote.updatedAt,
    })),
    ...deliveryTickets.map((ticket) => ({
      key: `ticket-${ticket.id}`,
      typeLabel: "Delivery",
      recordNumber: ticket.ticketNumber,
      href: `/delivery-tickets/${ticket.id}`,
      statusLabel:
        deliveryTicketStatusLabels[ticket.status as DeliveryTicketStatus] ??
        ticket.status,
      statusVariant: deliveryStatusVariant(ticket.status),
      updated: formatDate(ticket.updatedAt),
      sortDate: ticket.updatedAt,
    })),
    ...structures.map((structure) => ({
      key: `structure-${structure.id}`,
      typeLabel: "Structure",
      recordNumber: structure.structureNumber ?? "—",
      href: `/jobs/${jobId}?tab=production`,
      statusLabel:
        structureActivityStatusLabels[structure.status] ?? structure.status,
      statusVariant: structureActivityVariant(structure.status),
      updated: formatDate(structure.updatedAt),
      sortDate: structure.updatedAt,
    })),
    ...invoices.map((invoice) => ({
      key: `invoice-${invoice.id}`,
      typeLabel: "Invoice",
      recordNumber: invoice.invoiceNumber,
      href: `/invoices/${invoice.id}`,
      statusLabel: invoice.status.replace(/_/g, " "),
      statusVariant: invoiceStatusVariant(invoice.status),
      updated: formatDate(invoice.updatedAt),
      sortDate: invoice.updatedAt,
    })),
  ];

  const recentActivity = activity
    .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
    .slice(0, 6)
    .map(({ sortDate: _sortDate, ...item }) => item);

  return {
    attentionItems,
    recentActivity,
    structuresTotal: structures.length,
    structuresShipped: structures.filter((s) => s.status === "SHIPPED").length,
  };
}
