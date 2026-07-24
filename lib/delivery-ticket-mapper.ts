import type { DeliveryTicketDetailView } from "@/components/delivery-tickets/delivery-ticket-utils";
import type { DeliveryTicketRow } from "@/components/delivery-tickets/delivery-ticket-utils";
import {
  deliveryTicketStatusLabels,
  ticketNumberLabel,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import { formatWeightLb } from "@/lib/format";
import { deliveryTicketStatusVariant } from "@/lib/status-variants";
import type { Prisma } from "@/app/generated/prisma/client";

/** Columns needed by mapDbDeliveryTicketToListRow — shared by ticket list pages. */
export const deliveryTicketListSelect = {
  id: true,
  ticketNumber: true,
  jobId: true,
  customerId: true,
  jobNumber: true,
  projectName: true,
  customerName: true,
  deliveryDate: true,
  deliveryTime: true,
  driver: true,
  trailer: true,
  status: true,
  totalItems: true,
  totalWeight: true,
  _count: { select: { lineItems: true } },
} satisfies Prisma.DeliveryTicketSelect;

type DbDeliveryTicket = {
  id: string;
  ticketNumber: string | null;
  status: string;
  jobId: string | null;
  quoteId: string | null;
  customerId: string | null;
  customerName: string;
  projectName: string;
  deliveryDate: Date | null;
  deliveryTime: string | null;
  jobNumber: string | null;
  quoteNumber: string | null;
  deliveryAddress: string | null;
  siteContactName: string | null;
  siteContactPhone: string | null;
  requestedBy: string | null;
  createdBy: string | null;
  trailer: string | null;
  driver: string | null;
  loadSequence: string | null;
  craneRequired: boolean;
  forkliftRequired: boolean;
  specialEquipmentNeeded: string | null;
  totalItems: number | null;
  totalWeight: { toString(): string } | null;
  driverNotes: string | null;
  internalNotes: string | null;
  customerNotes: string | null;
  loadingNotes: string | null;
  siteInstructions: string | null;
  lineItems: {
    id: string;
    lineNumber: number;
    lineType: string;
    itemCode: string;
    description: string | null;
    quantity: { toString(): string };
    unit: string;
    weightEach: { toString(): string } | null;
    totalWeight: { toString(): string } | null;
    yardLocation: string | null;
    status: string;
    notes: string | null;
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

function formatDateIsoLocal(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function mapDbDeliveryTicketToDetailView(
  ticket: DbDeliveryTicket,
): DeliveryTicketDetailView {
  const statusKey = ticket.status as keyof typeof deliveryTicketStatusLabels;
  const statusLabel = deliveryTicketStatusLabels[statusKey] ?? ticket.status;

  return {
    id: ticket.id,
    ticketNumber: ticketNumberLabel(ticket.ticketNumber),
    title: ticket.ticketNumber
      ? `Ticket ${ticket.ticketNumber}`
      : "Planned Ticket",
    subtitle: `${ticket.projectName} — ${ticket.customerName}`,
    status: statusKey as DeliveryTicketDetailView["status"],
    statusLabel,
    statusVariant: deliveryTicketStatusVariant(ticket.status),
    deliveryDate: formatDate(ticket.deliveryDate),
    deliveryTime: ticket.deliveryTime ?? "—",
    trailer: ticket.trailer ?? "—",
    driver: ticket.driver ?? "—",
    totalWeight: formatWeightLb(ticket.totalWeight),
    jobNumber: ticket.jobNumber ?? "—",
    projectName: ticket.projectName,
    customer: ticket.customerName,
    deliveryAddress: ticket.deliveryAddress ?? "—",
    siteContactName: ticket.siteContactName ?? "—",
    siteContactPhone: ticket.siteContactPhone ?? "—",
    requestedBy: ticket.requestedBy ?? "—",
    createdBy: ticket.createdBy ?? "—",
    loadSequence: ticket.loadSequence ?? "—",
    craneRequired: ticket.craneRequired ? "Yes" : "No",
    forkliftRequired: ticket.forkliftRequired ? "Yes" : "No",
    specialEquipmentNeeded: ticket.specialEquipmentNeeded ?? "—",
    driverNotes: ticket.driverNotes ?? "—",
    internalNotes: ticket.internalNotes ?? "—",
    customerNotes: ticket.customerNotes ?? "—",
    loadingNotes: ticket.loadingNotes ?? "—",
    siteInstructions: ticket.siteInstructions ?? "—",
    lineItems: ticket.lineItems.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      type: line.lineType as DeliveryTicketDetailView["lineItems"][number]["type"],
      item: line.itemCode,
      description: line.description ?? "—",
      qty: line.quantity.toString(),
      unit: line.unit,
      weightEach: formatWeightLb(line.weightEach),
      totalWeight: formatWeightLb(line.totalWeight),
      yardLocation: line.yardLocation ?? "—",
      status: line.status.replace(/_/g, " "),
      statusVariant: "info" as const,
      notes: line.notes ?? "—",
    })),
    summary: {
      totalItems: String(ticket.totalItems ?? ticket.lineItems.length),
      totalWeight: formatWeightLb(ticket.totalWeight),
      deliveryDate: formatDate(ticket.deliveryDate),
      status: statusLabel,
    },
    relatedRecords: {
      jobNumber: ticket.jobNumber ?? "—",
      jobHref: ticket.jobId ? `/jobs/${ticket.jobId}` : null,
      quoteNumber: ticket.quoteNumber ?? "—",
      quoteHref: ticket.quoteId ? `/quotes/${ticket.quoteId}` : null,
      customer: ticket.customerName,
      customerHref: ticket.customerId ? `/customers/${ticket.customerId}` : null,
      invoice: "Not created",
      photos: "None",
      signedTicket: "Not uploaded",
    },
    statusHistory: [
      { id: "h1", label: "Draft created", complete: true },
      {
        id: "h2",
        label: "Scheduled",
        complete: ticket.status !== "DRAFT",
      },
      {
        id: "h3",
        label: "In transit",
        complete: ["IN_TRANSIT", "DELIVERED"].includes(ticket.status),
        current: ticket.status === "IN_TRANSIT",
      },
      {
        id: "h4",
        label: "Delivered",
        complete: ticket.status === "DELIVERED",
        current: ticket.status === "DELIVERED",
      },
    ],
  };
}

export function mapDbDeliveryTicketToListRow(ticket: {
  id: string;
  ticketNumber: string | null;
  jobId?: string | null;
  customerId?: string | null;
  jobNumber: string | null;
  projectName: string;
  customerName: string;
  deliveryDate: Date | null;
  deliveryTime: string | null;
  driver: string | null;
  trailer?: string | null;
  status: string;
  totalItems: number | null;
  totalWeight: { toString(): string } | null;
  _count: { lineItems: number };
}): DeliveryTicketRow {
  const totalWeight = ticket.totalWeight ? Number(ticket.totalWeight) : 0;
  const itemCount = ticket.totalItems ?? ticket._count.lineItems;

  return {
    id: ticket.id,
    ticketNumber: ticketNumberLabel(ticket.ticketNumber),
    jobId: ticket.jobId ?? null,
    customerId: ticket.customerId ?? null,
    jobNumber: ticket.jobNumber ?? "—",
    projectName: ticket.projectName,
    customer: ticket.customerName,
    deliveryDate: formatDate(ticket.deliveryDate),
    deliveryDateIso: ticket.deliveryDate
      ? formatDateIsoLocal(ticket.deliveryDate)
      : null,
    deliveryTime: ticket.deliveryTime,
    driver: ticket.driver ?? "—",
    trailer: ticket.trailer ?? "—",
    status: ticket.status as DeliveryTicketRow["status"],
    statusVariant: deliveryTicketStatusVariant(ticket.status),
    items: itemCount,
    totalWeight: totalWeight > 0 ? `${totalWeight.toLocaleString()} lb` : "—",
  };
}

export function computeDeliveryTicketSummaryStats(
  tickets: { status: string; deliveryDate: Date | null }[],
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  };

  const scheduledToday = tickets.filter(
    (t) =>
      t.status === "SCHEDULED" && isToday(t.deliveryDate),
  ).length;

  const readyToShip = tickets.filter((t) =>
    ["SCHEDULED", "DRAFT"].includes(t.status),
  ).length;

  const inTransit = tickets.filter((t) => t.status === "IN_TRANSIT").length;

  const deliveredThisWeek = tickets.filter((t) => {
    if (t.status !== "DELIVERED" || !t.deliveryDate) return false;
    const d = new Date(t.deliveryDate);
    return d >= today && d < weekEnd;
  }).length;

  const openTickets = tickets.filter((t) =>
    ["DRAFT", "SCHEDULED", "LOADING", "IN_TRANSIT"].includes(t.status),
  ).length;

  return {
    scheduledToday,
    readyToShip,
    inTransit,
    deliveredThisWeek,
    openTickets,
  };
}
