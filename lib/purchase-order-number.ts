import { randomUUID } from "crypto";
import type { Prisma } from "@/app/generated/prisma/client";

/** Sentinel year row in PurchaseOrderSequence for the global PO counter. */
export const GLOBAL_PURCHASE_ORDER_SEQUENCE_YEAR = 0;

export function formatPurchaseOrderNumber(sequenceNumber: number): string {
  return `PO${String(sequenceNumber).padStart(5, "0")}`;
}

export async function allocatePurchaseOrderNumber(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "PurchaseOrderSequence" ("id", "year", "lastNumber", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${GLOBAL_PURCHASE_ORDER_SEQUENCE_YEAR}, 10001, NOW(), NOW())
    ON CONFLICT ("year")
    DO UPDATE SET "lastNumber" = "PurchaseOrderSequence"."lastNumber" + 1, "updatedAt" = NOW()
    RETURNING "lastNumber"
  `;

  const sequenceNumber = Number(rows[0].lastNumber);
  const poNumber = formatPurchaseOrderNumber(sequenceNumber);

  const duplicate = await tx.purchaseOrder.findUnique({
    where: { poNumber },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error(`Purchase order number ${poNumber} already exists.`);
  }

  return { sequenceNumber, poNumber };
}
