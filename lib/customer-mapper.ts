import type {
  Contact,
  Customer,
  DeliveryTicket,
  Invoice,
  Job,
  Quote,
} from "@/app/generated/prisma/client";
import type {
  ContactRoleValue,
  CustomerContactRow,
  CustomerDetailStats,
  CustomerDetailView,
  CustomerRelatedDeliveryTicket,
  CustomerRelatedInvoice,
  CustomerRelatedJob,
  CustomerRelatedQuote,
  CustomerRow,
} from "@/components/customers/customer-utils";
import { jobStatusLabels } from "@/components/jobs/job-utils";
import {
  quoteStatusLabels,
  type QuoteStatus,
} from "@/components/quotes/quote-utils";
import { deliveryTicketStatusLabels } from "@/components/delivery-tickets/delivery-ticket-utils";
import { formatDateShort, formatUsd } from "@/lib/format";
import {
  customerStatusVariant,
  quoteStatusVariant,
} from "@/lib/status-variants";

const customerStatusLabels: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PROSPECT: "Prospect",
};

export function formatCustomerDate(date: Date) {
  return formatDateShort(date);
}

function formatDate(date: Date) {
  return formatCustomerDate(date);
}

function jobStatusVariant(status: string): CustomerRelatedJob["statusVariant"] {
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
    case "LOST":
      return "warning";
    default:
      return "neutral";
  }
}

export type CustomerRowAggregates = {
  openQuotes: number;
  balance: number;
};

export function mapCustomerToRow(
  customer: Customer,
  aggregates?: CustomerRowAggregates,
): CustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone ?? "—",
    town: customer.town ?? "—",
    status: customerStatusLabels[customer.status] ?? customer.status,
    statusVariant: customerStatusVariant(customer.status),
    openQuotes: aggregates?.openQuotes ?? 0,
    balance: formatUsd(aggregates?.balance ?? 0),
    lastActivity: formatDate(customer.updatedAt),
  };
}

export function mapJobToCustomerRelated(job: Job): CustomerRelatedJob {
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    projectName: job.projectName,
    status: jobStatusLabels[job.status] ?? job.status,
    statusVariant: jobStatusVariant(job.status),
    lastActivity: formatCustomerDate(job.updatedAt),
  };
}

export function mapQuoteToCustomerRelated(quote: Quote): CustomerRelatedQuote {
  const status = quote.status as QuoteStatus;

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    projectName: quote.projectName,
    status: quote.status,
    statusLabel: quoteStatusLabels[status] ?? quote.status,
    statusVariant: quoteStatusVariant(quote.status),
    total: formatUsd(quote.total),
    lastUpdated: formatCustomerDate(quote.updatedAt),
  };
}

export function mapDeliveryTicketToCustomerRelated(
  ticket: DeliveryTicket,
): CustomerRelatedDeliveryTicket {
  const status = ticket.status as keyof typeof deliveryTicketStatusLabels;

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    projectName: ticket.projectName,
    status: ticket.status,
    statusLabel: deliveryTicketStatusLabels[status] ?? ticket.status,
    deliveryDate: ticket.deliveryDate
      ? formatCustomerDate(ticket.deliveryDate)
      : "—",
  };
}

function invoiceStatusVariant(
  status: string,
): CustomerRelatedInvoice["statusVariant"] {
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

export function mapInvoiceToCustomerRelated(
  invoice: Invoice,
): CustomerRelatedInvoice {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    statusLabel: invoice.status.replace(/_/g, " "),
    statusVariant: invoiceStatusVariant(invoice.status),
    total: formatUsd(invoice.total),
    invoiceDate: invoice.invoiceDate
      ? formatCustomerDate(invoice.invoiceDate)
      : "—",
  };
}

export function mapContactToRow(
  contact: Contact,
  defaultForRoles: ContactRoleValue[] = [],
): CustomerContactRow {
  return {
    id: contact.id,
    name: contact.name,
    title: contact.title ?? "—",
    email: contact.email ?? "—",
    phone: contact.phone ?? "—",
    isPrimary: contact.isPrimary,
    roles: contact.roles as ContactRoleValue[],
    defaultForRoles,
    notes: contact.notes ?? "—",
  };
}

export function mapCustomerToDetailView(
  customer: Customer,
  relatedJobs: Job[],
  relatedQuotes: Quote[],
  relatedDeliveryTickets: DeliveryTicket[] = [],
  contacts: Contact[] = [],
  relatedInvoices: Invoice[] = [],
  roleDefaults: { role: string; contactId: string }[] = [],
  stats: CustomerDetailStats = {
    openJobs: 0,
    totalJobs: 0,
    openQuotes: 0,
    totalQuotes: 0,
    scheduledTickets: 0,
    totalTickets: 0,
    unpaidInvoices: 0,
    totalInvoices: 0,
    unpaidTotal: "$0",
  },
): CustomerDetailView {
  const row = mapCustomerToRow(customer);
  const defaultsByContact = new Map<string, ContactRoleValue[]>();
  for (const d of roleDefaults) {
    const list = defaultsByContact.get(d.contactId) ?? [];
    list.push(d.role as ContactRoleValue);
    defaultsByContact.set(d.contactId, list);
  }

  return {
    id: customer.id,
    name: customer.name,
    status: row.status,
    statusVariant: row.statusVariant,
    stats,
    phone: row.phone,
    address: customer.address ?? "—",
    town: customer.town ?? "—",
    state: customer.state ?? "—",
    zip: customer.zip ?? "—",
    notes: customer.notes ?? "—",
    createdAt: formatCustomerDate(customer.createdAt),
    updatedAt: formatCustomerDate(customer.updatedAt),
    contacts: contacts.map((contact) =>
      mapContactToRow(contact, defaultsByContact.get(contact.id) ?? []),
    ),
    relatedJobs: relatedJobs.map(mapJobToCustomerRelated),
    relatedQuotes: relatedQuotes.map(mapQuoteToCustomerRelated),
    relatedDeliveryTickets: relatedDeliveryTickets.map(mapDeliveryTicketToCustomerRelated),
    relatedInvoices: relatedInvoices.map(mapInvoiceToCustomerRelated),
  };
}
