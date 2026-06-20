import type { PrismaClient } from "@/app/generated/prisma/client";
import type { QuoteLineType } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";
import {
  deductInventoryForDeliveredTicket,
  reverseInventoryForTicket,
} from "@/lib/inventory-service";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type QuoteLineFulfillment = {
  quoteLineItemId: string;
  lineNumber: number;
  lineType: QuoteLineType;
  itemCode: string;
  description: string | null;
  quotedQty: number;
  shippedQty: number;
  remainingQty: number;
  eligible: boolean;
  eligibilityReason: string | null;
  jobStructureId: string | null;
  jobStructureStatus: string | null;
  productId: string | null;
  currentStock: number | null;
};

export async function getShippedQuantityForQuoteLine(
  client: DbClient,
  quoteLineItemId: string,
  excludeTicketId?: string,
): Promise<Prisma.Decimal> {
  const lines = await client.deliveryTicketLineItem.findMany({
    where: {
      quoteLineItemId,
      deliveryTicket: {
        status: "DELIVERED",
        ...(excludeTicketId ? { id: { not: excludeTicketId } } : {}),
      },
    },
    select: { quantity: true },
  });

  return lines.reduce(
    (sum, line) => sum.add(line.quantity),
    new Prisma.Decimal(0),
  );
}

export async function getQuoteLineFulfillment(
  client: DbClient,
  quoteId: string,
  excludeTicketId?: string,
): Promise<QuoteLineFulfillment[]> {
  const quote = await client.quote.findUnique({
    where: { id: quoteId },
    include: {
      lineItems: {
        orderBy: { lineNumber: "asc" },
        include: {
          product: { select: { id: true, currentStockQuantity: true, trackInventory: true } },
          jobStructure: { select: { id: true, status: true } },
        },
      },
    },
  });

  if (!quote) {
    return [];
  }

  const result: QuoteLineFulfillment[] = [];

  for (const line of quote.lineItems) {
    const shipped = await getShippedQuantityForQuoteLine(
      client,
      line.id,
      excludeTicketId,
    );
    const quotedQty = Number(line.quantity);
    const shippedQty = Number(shipped);
    const remainingQty = Math.max(0, quotedQty - shippedQty);

    let eligible = remainingQty > 0;
    let eligibilityReason: string | null = null;

    if (remainingQty <= 0) {
      eligible = false;
      eligibilityReason = "Fully shipped";
    } else if (line.lineType === "STOCK_PRODUCT") {
      if (line.product?.trackInventory) {
        const stock = line.product.currentStockQuantity;
        if (stock < remainingQty) {
          eligible = true;
          eligibilityReason = `Low stock (${stock} on hand)`;
        }
      }
    } else if (
      line.lineType === "CONFIGURABLE_STRUCTURE" ||
      line.lineType === "CUSTOM_STRUCTURE"
    ) {
      if (!line.jobStructure) {
        eligible = false;
        eligibilityReason = "No job structure linked";
      } else if (line.jobStructure.status !== "MADE") {
        eligible = false;
        eligibilityReason = `Structure status: ${line.jobStructure.status}`;
      }
    }

    result.push({
      quoteLineItemId: line.id,
      lineNumber: line.lineNumber,
      lineType: line.lineType,
      itemCode: line.itemCode,
      description: line.description,
      quotedQty,
      shippedQty,
      remainingQty,
      eligible,
      eligibilityReason,
      jobStructureId: line.jobStructureId,
      jobStructureStatus: line.jobStructure?.status ?? null,
      productId: line.productId,
      currentStock: line.product?.currentStockQuantity ?? null,
    });
  }

  return result;
}

/**
 * Mark ticket DELIVERED: deduct stock, ship structures, set timestamps.
 */
export async function markDeliveryTicketDelivered(
  client: PrismaClient,
  deliveryTicketId: string,
  options?: { signedBy?: string | null; verifiedBy?: string | null },
): Promise<void> {
  const ticket = await client.deliveryTicket.findUnique({
    where: { id: deliveryTicketId },
    include: {
      lineItems: {
        include: { jobStructure: true },
      },
    },
  });

  if (!ticket) {
    throw new Error("Delivery ticket not found.");
  }

  if (ticket.status === "DELIVERED") {
    return;
  }

  const deliveredAt = new Date();

  await client.$transaction(async (tx) => {
    await tx.deliveryTicket.update({
      where: { id: deliveryTicketId },
      data: {
        status: "DELIVERED",
        deliveredAt,
        signedBy: options?.signedBy ?? ticket.signedBy,
      },
    });

    for (const line of ticket.lineItems) {
      if (
        line.jobStructureId &&
        (line.lineType === "CONFIGURABLE_STRUCTURE" ||
          line.lineType === "CUSTOM_STRUCTURE")
      ) {
        await tx.jobStructure.update({
          where: { id: line.jobStructureId },
          data: { status: "SHIPPED", shippedDate: deliveredAt },
        });
      }
    }
  });

  await deductInventoryForDeliveredTicket(
    client,
    deliveryTicketId,
    deliveredAt,
    options?.verifiedBy,
  );
}

/**
 * Cancel a previously delivered ticket and restore inventory.
 */
export async function cancelDeliveredTicket(
  client: PrismaClient,
  deliveryTicketId: string,
): Promise<void> {
  const ticket = await client.deliveryTicket.findUnique({
    where: { id: deliveryTicketId },
  });

  if (!ticket) {
    throw new Error("Delivery ticket not found.");
  }

  if (ticket.status !== "DELIVERED") {
    throw new Error("Only delivered tickets can be reversed this way.");
  }

  await reverseInventoryForTicket(client, deliveryTicketId, new Date());

  await client.deliveryTicket.update({
    where: { id: deliveryTicketId },
    data: { status: "CANCELLED" },
  });
}
