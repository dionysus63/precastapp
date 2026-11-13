import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import {
  addLocalDays,
  parseLocalDay,
  startOfLocalDay,
  toLocalDayInput,
} from "@/lib/date-only";
import {
  markDeliveryTicketDelivered,
  undoTicketDelivery,
} from "@/lib/delivery-fulfillment";
import { ensureInvoiceAfterDelivery } from "@/lib/invoicing-service";
import type { ScanInActor } from "@/lib/ticket-scan/filing";
import {
  formatMonthDay,
  ScanInError,
  ticketStatusLabel,
} from "@/lib/ticket-scan/service";
import type {
  ScanInStillOutRow,
  ScanInSuggestion,
  StillOutUndo,
} from "@/lib/ticket-scan/view-types";

/**
 * "Still out" (Invoices → Scan In): tickets that have gone out with no signed
 * copy scanned in. This is the check Reconcile Day used to be.
 *
 * On the list:
 *  - a ticket scheduled for today or earlier that is not marked delivered
 *    (Scheduled, Loading, In Transit);
 *  - a delivered ticket with no signed copy filed, unless someone said
 *    "Delivered, No Signed Copy". Tickets delivered before Scan In went live
 *    (AppSettings.scanInStartedAt) are left alone: their paper was never
 *    going to be scanned.
 */

const LIVE_STATUSES = ["SCHEDULED", "LOADING", "IN_TRANSIT"] as const;
const STILL_OUT_LIMIT = 200;

const STILL_OUT_SELECT = {
  id: true,
  ticketNumber: true,
  customerName: true,
  projectName: true,
  status: true,
  deliveryDate: true,
  deliveredAt: true,
  signedFiles: {
    where: { isCurrent: true },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { createdAt: true },
  },
} as const satisfies Prisma.DeliveryTicketSelect;

type StillOutTicket = Prisma.DeliveryTicketGetPayload<{
  select: typeof STILL_OUT_SELECT;
}>;

async function scanInStartedAt(client: PrismaClient): Promise<Date> {
  const settings = await client.appSettings.findUnique({
    where: { id: "default" },
    select: { scanInStartedAt: true },
  });
  // No settings row yet: nothing delivered before this moment counts.
  return settings?.scanInStartedAt ?? new Date();
}

function stillOutWhere(
  startedAt: Date,
  excludeTicketIds: string[],
): Prisma.DeliveryTicketWhereInput {
  const tomorrow = addLocalDays(new Date(), 1);
  return {
    ticketNumber: { not: null },
    ...(excludeTicketIds.length > 0 ? { id: { notIn: excludeTicketIds } } : {}),
    OR: [
      { status: { in: [...LIVE_STATUSES] }, deliveryDate: { lt: tomorrow } },
      {
        status: "DELIVERED",
        deliveredAt: { gte: startedAt },
        closedWithoutSignedCopyAt: null,
        signedFiles: { none: { isCurrent: true } },
      },
    ],
  };
}

function outSince(ticket: StillOutTicket): Date {
  if (ticket.status === "DELIVERED") {
    return ticket.deliveredAt ?? ticket.deliveryDate ?? new Date();
  }
  return ticket.deliveryDate ?? new Date();
}

function toRow(ticket: StillOutTicket): ScanInStillOutRow {
  const since = outSince(ticket);
  const today = startOfLocalDay();
  const day = startOfLocalDay(since);
  const daysOut = Math.max(
    0,
    Math.round((today.getTime() - day.getTime()) / 86_400_000),
  );
  const delivered = ticket.status === "DELIVERED";
  const signed = ticket.signedFiles[0] ?? null;
  const sameYear = day.getFullYear() === today.getFullYear();
  return {
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber ?? "",
    customerName: ticket.customerName,
    projectName: ticket.projectName,
    dateLabel: sameYear
      ? formatMonthDay(day)
      : `${formatMonthDay(day)}-${day.getFullYear()}`,
    dateInput: toLocalDayInput(ticket.deliveryDate ?? since),
    daysOut,
    statusLabel: ticketStatusLabel(ticket.status, ticket.deliveredAt),
    delivered,
    signedNotDelivered: !delivered && signed != null,
    note:
      !delivered && signed
        ? `Signed copy filed ${formatMonthDay(signed.createdAt)}, not marked delivered`
        : null,
  };
}

/**
 * The Still Out list, oldest first. `excludeTicketIds` are the tickets whose
 * pages are in the scan being worked on: their paper is back.
 */
export async function listStillOut(
  client: PrismaClient,
  options: { excludeTicketIds?: string[] } = {},
): Promise<{ rows: ScanInStillOutRow[]; more: number }> {
  const where = stillOutWhere(
    await scanInStartedAt(client),
    options.excludeTicketIds ?? [],
  );
  const [tickets, total] = await Promise.all([
    client.deliveryTicket.findMany({
      where,
      // Close to oldest first; the exact order is settled below.
      orderBy: [{ deliveryDate: "asc" }, { ticketNumber: "asc" }],
      take: STILL_OUT_LIMIT,
      select: STILL_OUT_SELECT,
    }),
    client.deliveryTicket.count({ where }),
  ]);
  const rows = tickets
    .map((ticket) => ({ since: outSince(ticket).getTime(), row: toRow(ticket) }))
    .sort(
      (a, b) =>
        b.row.daysOut - a.row.daysOut ||
        a.since - b.since ||
        a.row.ticketNumber.localeCompare(b.row.ticketNumber),
    )
    .map((entry) => entry.row);
  return { rows, more: Math.max(0, total - rows.length) };
}

/**
 * Numbers offered while typing a ticket number on a page that could not be
 * read: recent tickets with no signed copy yet, newest first.
 */
export async function listTicketSuggestions(
  client: PrismaClient,
): Promise<ScanInSuggestion[]> {
  const tickets = await client.deliveryTicket.findMany({
    where: {
      ticketNumber: { not: null },
      status: { notIn: ["DRAFT", "CANCELLED"] },
      signedFiles: { none: { isCurrent: true } },
    },
    orderBy: [{ deliveryDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 150,
    select: { ticketNumber: true, customerName: true, projectName: true },
  });
  return tickets.map((ticket) => ({
    ticketNumber: ticket.ticketNumber!,
    label: [ticket.customerName, ticket.projectName].filter(Boolean).join(" · "),
  }));
}

function stockMessage(error: unknown): string | null {
  return error instanceof Error &&
    error.message.includes("Product_currentStockQuantity_nonneg")
    ? "Not enough stock on hand to mark this ticket delivered. Adjust inventory or the ticket's quantities first."
    : null;
}

/**
 * "Delivered, No Signed Copy" (and "Mark Delivered" on a ticket whose signed
 * copy is already filed): marks the ticket delivered if it is not yet, which
 * makes its invoice, and takes it off the Still Out list.
 */
export async function closeStillOutTicket(
  client: PrismaClient,
  ticketId: string,
  actor: ScanInActor,
): Promise<{ undo: StillOutUndo; warning: string | null; notice: string }> {
  const ticket = await client.deliveryTicket.findUnique({
    where: { id: ticketId },
    select: {
      status: true,
      ticketNumber: true,
      signedFiles: { where: { isCurrent: true }, take: 1, select: { id: true } },
    },
  });
  if (!ticket) {
    throw new ScanInError("That ticket is no longer on the server.");
  }
  const number = ticket.ticketNumber ?? "This ticket";
  if (ticket.status === "CANCELLED") {
    throw new ScanInError(`${number} was cancelled.`);
  }
  if (ticket.status === "DRAFT") {
    throw new ScanInError(`${number} is still a draft. Schedule it first.`);
  }

  const wasDelivered = ticket.status === "DELIVERED";
  let warning: string | null = null;
  let invoiceNumber: string | null = null;
  let invoiceId: string | null = null;
  let invoiceMade = false;
  if (!wasDelivered) {
    try {
      await markDeliveryTicketDelivered(client, ticketId, {
        verifiedBy: actor.displayName,
      });
    } catch (error) {
      throw new ScanInError(
        stockMessage(error) ??
          (error instanceof Error ? error.message : "Could not mark delivered."),
      );
    }
    const invoice = await ensureInvoiceAfterDelivery(client, ticketId);
    warning = invoice.warning;
    invoiceNumber = invoice.invoice?.invoiceNumber ?? null;
    invoiceId = invoice.invoice?.id ?? null;
    invoiceMade = invoice.created;
  }

  const hasSignedCopy = ticket.signedFiles.length > 0;
  if (!hasSignedCopy) {
    await client.deliveryTicket.update({
      where: { id: ticketId },
      data: {
        closedWithoutSignedCopyAt: new Date(),
        closedWithoutSignedCopyBy: actor.displayName,
      },
    });
  }

  await writeAuditLog({
    userId: actor.id,
    action: hasSignedCopy
      ? "ticket.deliver"
      : "ticket.closeWithoutSignedCopy",
    entityType: "DeliveryTicket",
    entityId: ticketId,
    summary: hasSignedCopy
      ? `${actor.displayName} marked ticket ${number} delivered from Scan In`
      : `${actor.displayName} closed ticket ${number} with no signed copy${wasDelivered ? "" : " (marked delivered)"}`,
  }).catch(() => undefined);

  const parts = [
    hasSignedCopy
      ? "Marked delivered."
      : wasDelivered
        ? "Closed with no signed copy."
        : "Marked delivered, no signed copy.",
    invoiceMade && invoiceNumber ? `Invoice ${invoiceNumber} made.` : null,
  ].filter(Boolean);

  return {
    undo: {
      kind: "closed",
      ticketId,
      wasMarkedDelivered: !wasDelivered,
      invoiceNumber: invoiceMade ? invoiceNumber : null,
      invoiceId: invoiceMade ? invoiceId : null,
    },
    warning,
    notice: parts.join(" "),
  };
}

/**
 * Undo of "Delivered, No Signed Copy": the ticket goes back on the list. When
 * that click also marked it delivered, the delivery is undone too, which
 * deletes the unpaid invoice it made (the screen asks first).
 */
export async function reopenStillOutTicket(
  client: PrismaClient,
  ticketId: string,
  actor: ScanInActor,
  options: { undoDelivery: boolean; removeUnpaidInvoice: boolean },
): Promise<void> {
  const ticket = await client.deliveryTicket.findUnique({
    where: { id: ticketId },
    select: { status: true, ticketNumber: true },
  });
  if (!ticket) {
    throw new ScanInError("That ticket is no longer on the server.");
  }
  const number = ticket.ticketNumber ?? ticketId;
  if (options.undoDelivery && ticket.status === "DELIVERED") {
    const undone = await undoTicketDelivery(
      client,
      ticketId,
      "SCHEDULED",
      actor.displayName,
      { removeUnpaidInvoice: options.removeUnpaidInvoice },
    );
    if (undone.removedInvoiceNumber) {
      await writeAuditLog({
        userId: actor.id,
        action: "invoice.delete",
        entityType: "Invoice",
        summary: `${actor.displayName} undid the delivery of ticket ${number} from Scan In, which deleted unpaid invoice ${undone.removedInvoiceNumber}`,
      }).catch(() => undefined);
    }
  }
  await client.deliveryTicket.update({
    where: { id: ticketId },
    data: { closedWithoutSignedCopyAt: null, closedWithoutSignedCopyBy: null },
  });
  await writeAuditLog({
    userId: actor.id,
    action: "ticket.reopenWithoutSignedCopy",
    entityType: "DeliveryTicket",
    entityId: ticketId,
    summary: `${actor.displayName} put ticket ${number} back on Still Out`,
  }).catch(() => undefined);
}

/** "Move Date": the ticket did not go out that day. Returns the old date. */
export async function moveStillOutTicketDate(
  client: PrismaClient,
  ticketId: string,
  newDateInput: string,
): Promise<{ undo: StillOutUndo; notice: string }> {
  const newDate = parseLocalDay(newDateInput);
  if (!newDate) {
    throw new ScanInError("Pick the new delivery date.");
  }
  const ticket = await client.deliveryTicket.findUnique({
    where: { id: ticketId },
    select: { status: true, ticketNumber: true, deliveryDate: true },
  });
  if (!ticket) {
    throw new ScanInError("That ticket is no longer on the server.");
  }
  const number = ticket.ticketNumber ?? "This ticket";
  if (ticket.status === "DELIVERED" || ticket.status === "CANCELLED") {
    throw new ScanInError(
      `${number} is ${ticket.status === "DELIVERED" ? "already delivered" : "cancelled"}, so its date cannot be moved here.`,
    );
  }
  const moved = await client.deliveryTicket.updateMany({
    where: { id: ticketId, status: ticket.status },
    data: { deliveryDate: newDate },
  });
  if (moved.count === 0) {
    throw new ScanInError(
      `${number} changed a moment ago. Look at it again before moving its date.`,
    );
  }
  return {
    undo: {
      kind: "moved",
      ticketId,
      previousDate: ticket.deliveryDate
        ? toLocalDayInput(ticket.deliveryDate)
        : "",
    },
    notice: `Moved to ${formatMonthDay(newDate)}-${newDate.getFullYear()}.`,
  };
}

/** Undo of Move Date: back to the date it had (or to no date). */
export async function restoreStillOutTicketDate(
  client: PrismaClient,
  ticketId: string,
  previousDateInput: string,
): Promise<void> {
  const previous = previousDateInput ? parseLocalDay(previousDateInput) : null;
  if (previousDateInput && !previous) {
    throw new ScanInError("That date is not valid.");
  }
  const restored = await client.deliveryTicket.updateMany({
    where: { id: ticketId, status: { notIn: ["DELIVERED", "CANCELLED"] } },
    data: { deliveryDate: previous },
  });
  if (restored.count === 0) {
    throw new ScanInError(
      "This ticket was delivered or cancelled in the meantime, so its date was left alone.",
    );
  }
}

/** "Cancel Ticket": it never went out and is not going to. No way back. */
export async function cancelStillOutTicket(
  client: PrismaClient,
  ticketId: string,
  actor: ScanInActor,
): Promise<{ notice: string }> {
  const ticket = await client.deliveryTicket.findUnique({
    where: { id: ticketId },
    select: { status: true, ticketNumber: true },
  });
  if (!ticket) {
    throw new ScanInError("That ticket is no longer on the server.");
  }
  const number = ticket.ticketNumber ?? "This ticket";
  if (ticket.status === "CANCELLED") {
    return { notice: `${number} was already cancelled.` };
  }
  if (ticket.status === "DELIVERED") {
    throw new ScanInError(
      `${number} is marked delivered. Undo the delivery from the Delivery Hub before cancelling it.`,
    );
  }
  // Compare-and-set against the status just read: a ticket someone marked
  // delivered in the meantime must not be cancelled over (stock is deducted).
  const cancelled = await client.deliveryTicket.updateMany({
    where: { id: ticketId, status: ticket.status },
    data: { status: "CANCELLED" },
  });
  if (cancelled.count === 0) {
    throw new ScanInError(
      `${number} changed a moment ago. Look at it again before cancelling.`,
    );
  }
  await writeAuditLog({
    userId: actor.id,
    action: "ticket.cancel",
    entityType: "DeliveryTicket",
    entityId: ticketId,
    summary: `${actor.displayName} cancelled ticket ${number} from Scan In`,
  }).catch(() => undefined);
  return { notice: `${number} cancelled.` };
}
