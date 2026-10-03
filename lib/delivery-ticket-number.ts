import { randomUUID } from "crypto";
import type { Prisma } from "@/app/generated/prisma/client";

/** Sentinel year row in DeliveryTicketSequence for the global ticket counter. */
export const GLOBAL_DELIVERY_TICKET_SEQUENCE_YEAR = 0;

export function formatDeliveryTicketNumber(sequenceNumber: number): string {
  return `DT${String(sequenceNumber).padStart(5, "0")}`;
}

export async function allocateDeliveryTicketNumber(
  tx: Prisma.TransactionClient,
) {
  const calendarYear = new Date().getFullYear();

  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "DeliveryTicketSequence" ("id", "year", "lastNumber", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${GLOBAL_DELIVERY_TICKET_SEQUENCE_YEAR}, 10001, NOW(), NOW())
    ON CONFLICT ("year")
    DO UPDATE SET "lastNumber" = "DeliveryTicketSequence"."lastNumber" + 1, "updatedAt" = NOW()
    RETURNING "lastNumber"
  `;

  const sequenceNumber = Number(rows[0].lastNumber);
  const ticketNumber = formatDeliveryTicketNumber(sequenceNumber);

  const duplicate = await tx.deliveryTicket.findUnique({
    where: { ticketNumber },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error(`Delivery ticket number ${ticketNumber} already exists.`);
  }

  return {
    year: calendarYear,
    yearTwoDigit: calendarYear % 100,
    sequenceNumber,
    ticketNumber,
  };
}
