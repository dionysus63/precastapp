import { randomUUID } from "crypto";
import type { Prisma } from "@/app/generated/prisma/client";

/** Sentinel year row in DeliveryTicketSequence for the global ticket counter. */
export const GLOBAL_DELIVERY_TICKET_SEQUENCE_YEAR = 0;

export function formatTicketNumber(
  prefix: string,
  sequenceNumber: number,
): string {
  return `${prefix}${String(sequenceNumber).padStart(5, "0")}`;
}

/**
 * Allocates the next global ticket number using the prefix and starting
 * number from Settings -> Billing. Raising the starting number jumps the
 * counter forward on the next allocation; lowering it never reissues
 * numbers (GREATEST keeps the counter monotonic).
 */
export async function allocateDeliveryTicketNumber(
  tx: Prisma.TransactionClient,
) {
  const settings = await tx.appSettings.findUnique({
    where: { id: "default" },
    select: { ticketNumberPrefix: true, ticketNumberStart: true },
  });
  const prefix = settings?.ticketNumberPrefix?.trim() || "T";
  const start = settings?.ticketNumberStart ?? 10001;

  const calendarYear = new Date().getFullYear();

  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "DeliveryTicketSequence" ("id", "year", "lastNumber", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${GLOBAL_DELIVERY_TICKET_SEQUENCE_YEAR}, ${start}, NOW(), NOW())
    ON CONFLICT ("year")
    DO UPDATE SET
      "lastNumber" = GREATEST("DeliveryTicketSequence"."lastNumber" + 1, ${start}),
      "updatedAt" = NOW()
    RETURNING "lastNumber"
  `;

  const sequenceNumber = Number(rows[0].lastNumber);
  const ticketNumber = formatTicketNumber(prefix, sequenceNumber);

  const duplicate = await tx.deliveryTicket.findUnique({
    where: { ticketNumber },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error(`Ticket number ${ticketNumber} already exists.`);
  }

  return {
    year: calendarYear,
    yearTwoDigit: calendarYear % 100,
    sequenceNumber,
    ticketNumber,
  };
}

/**
 * The invoice for a ticket carries the same digits with the invoice prefix:
 * ticket T10024 -> invoice I10024. Returns null for legacy ticket formats
 * (e.g. DT-26-0311) that don't end in a plain number run.
 */
export function deriveInvoiceNumberFromTicket(
  ticketNumber: string,
  invoicePrefix: string,
): { invoiceNumber: string; sequenceNumber: number } | null {
  const match = /^[A-Za-z]+(\d+)$/.exec(ticketNumber.trim());
  if (!match) {
    return null;
  }
  return {
    invoiceNumber: `${invoicePrefix}${match[1]}`,
    sequenceNumber: Number(match[1]),
  };
}
