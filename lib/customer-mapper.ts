import type { Contact, Customer, DeliveryTicket, Job, Quote } from "@/app/generated/prisma/client";
import type {
  CustomerContactRow,
  CustomerDetailView,
  CustomerRelatedDeliveryTicket,
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

export function mapCustomerToRow(customer: Customer): CustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    primaryContact: customer.primaryContactName ?? "—",
    phone: customer.phone ?? "—",
    email: customer.email ?? "—",
    status: customerStatusLabels[customer.status] ?? customer.status,
    statusVariant: customerStatusVariant(customer.status),
    openQuotes: 0,
    balance: "$0",
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

export function mapContactToRow(contact: Contact): CustomerContactRow {
  return {
    id: contact.id,
    name: contact.name,
    title: contact.title ?? "—",
    email: contact.email ?? "—",
    phone: contact.phone ?? "—",
    isPrimary: contact.isPrimary,
    notes: contact.notes ?? "—",
  };
}

export function mapCustomerToDetailView(
  customer: Customer,
  relatedJobs: Job[],
  relatedQuotes: Quote[],
  relatedDeliveryTickets: DeliveryTicket[] = [],
  contacts: Contact[] = [],
): CustomerDetailView {
  const row = mapCustomerToRow(customer);

  return {
    id: customer.id,
    name: customer.name,
    status: row.status,
    statusVariant: row.statusVariant,
    primaryContact: row.primaryContact,
    phone: row.phone,
    email: row.email,
    address: customer.address ?? "—",
    town: customer.town ?? "—",
    state: customer.state ?? "—",
    zip: customer.zip ?? "—",
    notes: customer.notes ?? "—",
    createdAt: formatCustomerDate(customer.createdAt),
    updatedAt: formatCustomerDate(customer.updatedAt),
    contacts: contacts.map(mapContactToRow),
    relatedJobs: relatedJobs.map(mapJobToCustomerRelated),
    relatedQuotes: relatedQuotes.map(mapQuoteToCustomerRelated),
    relatedDeliveryTickets: relatedDeliveryTickets.map(mapDeliveryTicketToCustomerRelated),
  };
}
