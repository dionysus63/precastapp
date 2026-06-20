import { randomUUID } from "crypto";
import type { Prisma } from "@/app/generated/prisma/client";

export function formatDeliveryTicketNumber(
  year: number,
  sequenceNumber: number,
): string {
  const yearTwoDigit = year % 100;
  return `DT-${String(yearTwoDigit).padStart(2, "0")}-${String(sequenceNumber).padStart(3, "0")}`;
}

export async function allocateDeliveryTicketNumber(
  tx: Prisma.TransactionClient,
  year: number = new Date().getFullYear(),
) {
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "DeliveryTicketSequence" ("id", "year", "lastNumber", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${year}, 1, NOW(), NOW())
    ON CONFLICT ("year")
    DO UPDATE SET "lastNumber" = "DeliveryTicketSequence"."lastNumber" + 1, "updatedAt" = NOW()
    RETURNING "lastNumber"
  `;

  const sequenceNumber = Number(rows[0].lastNumber);
  const yearTwoDigit = year % 100;
  const ticketNumber = formatDeliveryTicketNumber(year, sequenceNumber);

  const duplicate = await tx.deliveryTicket.findUnique({
    where: { ticketNumber },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error(`Delivery ticket number ${ticketNumber} already exists.`);
  }

  return {
    year,
    yearTwoDigit,
    sequenceNumber,
    ticketNumber,
  };
}
