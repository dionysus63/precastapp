import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

/** Digits after the dash; a prefix that passes 9999 simply grows longer. */
const NUMBER_DIGITS = 4;
/** Stands in for a missing second character (a vendor named "Q" gives "QX"). */
const PREFIX_FILLER = "X";

/**
 * The two characters a vendor's purchase order numbers start with: the first
 * two letters or digits of the vendor name, upper case. Spaces, punctuation
 * and accents are passed over, so "E.J. Prescott" gives "EJ" and "3M" gives
 * "3M". A name with fewer than two usable characters is filled with "X".
 */
export function purchaseOrderPrefix(vendorName: string): string {
  const usable = vendorName
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  return usable.slice(0, 2).padEnd(2, PREFIX_FILLER);
}

/** "HA" and 1 -> "HA-0001". */
export function formatPurchaseOrderNumber(
  prefix: string,
  sequenceNumber: number,
): string {
  return `${prefix}-${String(sequenceNumber).padStart(NUMBER_DIGITS, "0")}`;
}

/**
 * The prefix of a number in the vendor style ("HA-0007" -> "HA"), or null
 * for anything else, such as the old "PO10001" numbers.
 */
export function purchaseOrderNumberPrefix(poNumber: string): string | null {
  const match = /^([A-Z0-9]{2})-\d+$/.exec(poNumber);
  return match ? match[1]! : null;
}

/**
 * Takes the next number for a vendor. The counter runs per prefix, not per
 * vendor: two vendors that share their first two letters share one run, so
 * the same number is never given out twice. Must run inside the transaction
 * that creates the purchase order, so a failed save gives its number back.
 */
export async function allocatePurchaseOrderNumber(
  tx: Prisma.TransactionClient,
  vendorName: string,
) {
  const prefix = purchaseOrderPrefix(vendorName);

  // A number can already be taken only if someone typed it in by hand or
  // restored old data; step past it instead of failing the save.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
      INSERT INTO "PurchaseOrderPrefixSequence" ("prefix", "lastNumber", "createdAt", "updatedAt")
      VALUES (${prefix}, 1, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
      ON CONFLICT ("prefix")
      DO UPDATE SET
        "lastNumber" = "PurchaseOrderPrefixSequence"."lastNumber" + 1,
        "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      RETURNING "lastNumber"
    `;

    const sequenceNumber = Number(rows[0]!.lastNumber);
    const poNumber = formatPurchaseOrderNumber(prefix, sequenceNumber);
    const duplicate = await tx.purchaseOrder.findUnique({
      where: { poNumber },
      select: { id: true },
    });
    if (!duplicate) {
      return { prefix, sequenceNumber, poNumber };
    }
  }

  throw new Error(`Could not find a free purchase order number for ${prefix}.`);
}

/**
 * Gives a deleted purchase order's number back, when it was the newest one of
 * its letters: the next order for those letters then takes it again instead
 * of leaving a gap. An older number stays a gap (numbers after it are in
 * use), and the old "PO10001" style numbers have no run to give back to.
 * Returns whether the number was given back.
 */
export async function releasePurchaseOrderNumber(
  tx: Prisma.TransactionClient,
  poNumber: string,
  sequenceNumber: number,
): Promise<boolean> {
  const prefix = purchaseOrderNumberPrefix(poNumber);
  if (!prefix || formatPurchaseOrderNumber(prefix, sequenceNumber) !== poNumber) {
    return false;
  }
  const released = await tx.purchaseOrderPrefixSequence.updateMany({
    where: { prefix, lastNumber: sequenceNumber },
    data: { lastNumber: sequenceNumber - 1 },
  });
  return released.count > 0;
}

/**
 * The number the next purchase order for this vendor would get, without
 * taking it. For showing on screen only: the real number is given out when
 * the purchase order is saved, and can be higher if someone else saved one
 * for the same prefix in between.
 */
export async function peekNextPurchaseOrderNumber(
  client: DbClient,
  vendorName: string,
): Promise<string> {
  const prefix = purchaseOrderPrefix(vendorName);
  const row = await client.purchaseOrderPrefixSequence.findUnique({
    where: { prefix },
    select: { lastNumber: true },
  });
  return formatPurchaseOrderNumber(prefix, (row?.lastNumber ?? 0) + 1);
}
