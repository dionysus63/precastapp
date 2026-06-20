import type { PrismaClient } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";

export type ProductionLineInput = {
  productId: string;
  quantityProduced: number;
};

/**
 * Record daily stock production: ledger (+qty) and bump Product.currentStockQuantity.
 */
export async function saveDailyProductionEntry(
  client: PrismaClient,
  input: {
    productionDate: Date;
    enteredBy?: string | null;
    notes?: string | null;
    batchLabel?: string | null;
    lines: ProductionLineInput[];
  },
): Promise<string> {
  if (input.lines.length === 0) {
    throw new Error("Add at least one production line.");
  }

  return client.$transaction(async (tx) => {
    const entry = await tx.dailyProductionEntry.create({
      data: {
        productionDate: input.productionDate,
        enteredBy: input.enteredBy ?? null,
        notes: input.notes ?? null,
        batchLabel: input.batchLabel ?? null,
      },
    });

    for (const line of input.lines) {
      const product = await tx.product.findUnique({
        where: { id: line.productId },
        select: { id: true, trackInventory: true, currentStockQuantity: true },
      });

      if (!product) {
        throw new Error("Product not found.");
      }

      if (!product.trackInventory) {
        throw new Error("Product is not tracked in inventory.");
      }

      const qty = new Prisma.Decimal(line.quantityProduced);
      if (qty.lte(0)) {
        throw new Error("Quantity produced must be greater than zero.");
      }

      const productionLine = await tx.dailyProductionLine.create({
        data: {
          productionEntryId: entry.id,
          productId: line.productId,
          quantityProduced: qty,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId: line.productId,
          quantityChange: qty,
          transactionType: "PRODUCTION",
          transactionDate: input.productionDate,
          referenceType: "DAILY_PRODUCTION_LINE",
          referenceId: productionLine.id,
          createdBy: input.enteredBy ?? null,
        },
      });

      await tx.product.update({
        where: { id: line.productId },
        data: {
          currentStockQuantity: product.currentStockQuantity + line.quantityProduced,
        },
      });
    }

    return entry.id;
  });
}

/**
 * Deduct stock when a delivery ticket is marked DELIVERED.
 */
export async function deductInventoryForDeliveredTicket(
  client: PrismaClient,
  deliveryTicketId: string,
  deliveredAt: Date,
  createdBy?: string | null,
): Promise<void> {
  const ticket = await client.deliveryTicket.findUnique({
    where: { id: deliveryTicketId },
    include: {
      lineItems: {
        where: { lineType: "STOCK_PRODUCT", productId: { not: null } },
        include: { product: { select: { id: true, trackInventory: true, currentStockQuantity: true } } },
      },
    },
  });

  if (!ticket) {
    throw new Error("Delivery ticket not found.");
  }

  await client.$transaction(async (tx) => {
    for (const line of ticket.lineItems) {
      if (!line.productId || !line.product?.trackInventory) {
        continue;
      }

      const qty = line.quantity;
      const negQty = qty.mul(-1);

      await tx.inventoryTransaction.create({
        data: {
          productId: line.productId,
          quantityChange: negQty,
          transactionType: "DELIVERY",
          transactionDate: deliveredAt,
          referenceType: "DELIVERY_TICKET_LINE_ITEM",
          referenceId: line.id,
          createdBy: createdBy ?? null,
        },
      });

      const newStock = line.product.currentStockQuantity - Number(qty);
      await tx.product.update({
        where: { id: line.productId },
        data: { currentStockQuantity: Math.max(0, newStock) },
      });

      await tx.deliveryTicketLineItem.update({
        where: { id: line.id },
        data: { status: "DELIVERED" },
      });
    }
  });
}

/**
 * Manual stock adjustment (+/- qty) with ledger entry.
 */
export async function adjustInventory(
  client: PrismaClient,
  input: {
    productId: string;
    quantityChange: number;
    transactionDate?: Date;
    notes?: string | null;
    createdBy?: string | null;
  },
): Promise<void> {
  if (!Number.isFinite(input.quantityChange) || input.quantityChange === 0) {
    throw new Error("Adjustment quantity cannot be zero.");
  }

  const product = await client.product.findUnique({
    where: { id: input.productId },
    select: { id: true, trackInventory: true, currentStockQuantity: true },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  if (!product.trackInventory) {
    throw new Error("Product is not tracked in inventory.");
  }

  const qty = new Prisma.Decimal(input.quantityChange);
  const transactionDate = input.transactionDate ?? new Date();

  await client.$transaction(async (tx) => {
    await tx.inventoryTransaction.create({
      data: {
        productId: input.productId,
        quantityChange: qty,
        transactionType: "ADJUSTMENT",
        transactionDate,
        notes: input.notes ?? null,
        createdBy: input.createdBy ?? null,
      },
    });

    const newStock = product.currentStockQuantity + input.quantityChange;
    await tx.product.update({
      where: { id: input.productId },
      data: { currentStockQuantity: Math.max(0, newStock) },
    });
  });
}

/**
 * Reverse stock deductions when a delivered ticket is cancelled.
 */
export async function reverseInventoryForTicket(
  client: PrismaClient,
  deliveryTicketId: string,
  transactionDate: Date,
  createdBy?: string | null,
): Promise<void> {
  const existing = await client.inventoryTransaction.findMany({
    where: {
      referenceType: "DELIVERY_TICKET_LINE_ITEM",
      transactionType: "DELIVERY",
      referenceId: {
        in: (
          await client.deliveryTicketLineItem.findMany({
            where: { deliveryTicketId },
            select: { id: true },
          })
        ).map((l) => l.id),
      },
    },
  });

  if (existing.length === 0) {
    return;
  }

  await client.$transaction(async (tx) => {
    for (const txn of existing) {
      const reversalQty = txn.quantityChange.mul(-1);

      await tx.inventoryTransaction.create({
        data: {
          productId: txn.productId,
          quantityChange: reversalQty,
          transactionType: "REVERSAL",
          transactionDate,
          referenceType: txn.referenceType,
          referenceId: txn.referenceId,
          notes: `Reversal of delivery ticket ${deliveryTicketId}`,
          createdBy: createdBy ?? null,
        },
      });

      const product = await tx.product.findUnique({
        where: { id: txn.productId },
        select: { currentStockQuantity: true },
      });

      if (product) {
        await tx.product.update({
          where: { id: txn.productId },
          data: {
            currentStockQuantity:
              product.currentStockQuantity + Number(reversalQty),
          },
        });
      }
    }
  });
}
