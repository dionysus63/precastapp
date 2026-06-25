import type {
  InventoryReferenceType,
  InventoryTransactionType,
  PrismaClient,
} from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ProductionLineInput = {
  productId: string;
  quantityProduced: number;
};

export type PurchaseReceiptLineInput = {
  productId: string;
  quantityReceived: number;
};

type StockChangeInput = {
  productId: string;
  /** Signed ledger magnitude: positive adds stock, negative removes it. */
  quantityChange: Prisma.Decimal;
  transactionType: InventoryTransactionType;
  transactionDate: Date;
  referenceType?: InventoryReferenceType | null;
  referenceId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  /**
   * When false (default), the change is rejected if it would drive
   * `currentStockQuantity` below zero. Inbound changes (receipts, production,
   * reversals) pass `allowNegative: true` since they can only increase stock.
   */
  allowNegative?: boolean;
};

/**
 * The single source of truth for changing stock. Writes the append-only
 * `InventoryTransaction` ledger row AND adjusts the denormalized
 * `Product.currentStockQuantity` using an **atomic** `increment`, so concurrent
 * stock changes can never lose updates (no read-modify-write). Must be called
 * inside a `$transaction` so the ledger row and the balance update commit
 * together.
 */
async function applyStockChange(
  tx: DbClient,
  input: StockChangeInput,
): Promise<void> {
  await tx.inventoryTransaction.create({
    data: {
      productId: input.productId,
      quantityChange: input.quantityChange,
      transactionType: input.transactionType,
      transactionDate: input.transactionDate,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
    },
  });

  // `currentStockQuantity` is an Int balance; ledger magnitudes are integral in
  // practice. Round defensively so a stray fractional Decimal can't fail the
  // Int update.
  const balanceDelta = Math.round(input.quantityChange.toNumber());

  if (!input.allowNegative && balanceDelta < 0) {
    const updated = await tx.product.updateMany({
      where: {
        id: input.productId,
        currentStockQuantity: { gte: Math.abs(balanceDelta) },
      },
      data: { currentStockQuantity: { increment: balanceDelta } },
    });

    if (updated.count === 0) {
      throw new Error(
        "Insufficient stock: this change would drive the on-hand quantity below zero.",
      );
    }
    return;
  }

  await tx.product.update({
    where: { id: input.productId },
    data: { currentStockQuantity: { increment: balanceDelta } },
  });
}

/**
 * Record purchased casting inventory: ledger (+qty) and bump Product.currentStockQuantity.
 * Must be called inside a `$transaction` — the caller owns the transaction boundary so
 * BOM lookups and receipt writes can be made atomic together.
 */
export async function savePurchaseReceiptEntry(
  tx: DbClient,
  input: {
    receiptDate: Date;
    supplierId?: string | null;
    enteredBy?: string | null;
    notes?: string | null;
    batchLabel?: string | null;
    lines: PurchaseReceiptLineInput[];
  },
): Promise<string> {
  if (input.lines.length === 0) {
    throw new Error("Add at least one receipt line.");
  }

  const entry = await tx.purchaseReceiptEntry.create({
    data: {
      receiptDate: input.receiptDate,
      supplierId: input.supplierId ?? null,
      enteredBy: input.enteredBy ?? null,
      notes: input.notes ?? null,
      batchLabel: input.batchLabel ?? null,
    },
  });

  for (const line of input.lines) {
    const product = await tx.product.findUnique({
      where: { id: line.productId },
      select: {
        id: true,
        trackInventory: true,
        castingRole: true,
      },
    });

    if (!product) {
      throw new Error("Product not found.");
    }

    if (!product.trackInventory) {
      throw new Error("Product is not tracked in inventory.");
    }

    if (product.castingRole === "ASSEMBLY") {
      throw new Error("Receive component pieces, not casting assemblies.");
    }

    const qty = new Prisma.Decimal(line.quantityReceived);
    if (qty.lte(0)) {
      throw new Error("Quantity received must be greater than zero.");
    }

    const receiptLine = await tx.purchaseReceiptLine.create({
      data: {
        purchaseReceiptId: entry.id,
        productId: line.productId,
        quantityReceived: qty,
      },
    });

    await applyStockChange(tx, {
      productId: line.productId,
      quantityChange: qty,
      transactionType: "PURCHASE_RECEIPT",
      transactionDate: input.receiptDate,
      referenceType: "PURCHASE_RECEIPT_LINE",
      referenceId: receiptLine.id,
      createdBy: input.enteredBy ?? null,
      allowNegative: true,
    });
  }

  return entry.id;
}

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
        select: { id: true, trackInventory: true },
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

      await applyStockChange(tx, {
        productId: line.productId,
        quantityChange: qty,
        transactionType: "PRODUCTION",
        transactionDate: input.productionDate,
        referenceType: "DAILY_PRODUCTION_LINE",
        referenceId: productionLine.id,
        createdBy: input.enteredBy ?? null,
        allowNegative: true,
      });
    }

    return entry.id;
  });
}

/**
 * Deduct stock when a delivery ticket is marked DELIVERED. Idempotent per line:
 * line items already marked DELIVERED are skipped so a re-run (or a concurrent
 * second "mark delivered") cannot double-deduct. Must be called inside the same
 * `$transaction` that flips the ticket/line status.
 */
export async function deductInventoryForDeliveredTicket(
  client: DbClient,
  deliveryTicketId: string,
  deliveredAt: Date,
  createdBy?: string | null,
): Promise<void> {
  const ticket = await client.deliveryTicket.findUnique({
    where: { id: deliveryTicketId },
    include: {
      lineItems: {
        where: { lineType: "STOCK_PRODUCT", productId: { not: null } },
        include: {
          product: { select: { id: true, trackInventory: true } },
        },
      },
    },
  });

  if (!ticket) {
    throw new Error("Delivery ticket not found.");
  }

  for (const line of ticket.lineItems) {
    if (!line.productId || !line.product?.trackInventory) {
      continue;
    }

    // Idempotency guard: a line already marked DELIVERED has already been
    // deducted. Skip it so concurrent / repeated marks don't double-deduct.
    if (line.status === "DELIVERED") {
      continue;
    }

    const negQty = line.quantity.mul(-1);

    await applyStockChange(client, {
      productId: line.productId,
      quantityChange: negQty,
      transactionType: "DELIVERY",
      transactionDate: deliveredAt,
      referenceType: "DELIVERY_TICKET_LINE_ITEM",
      referenceId: line.id,
      createdBy: createdBy ?? null,
      allowNegative: true,
    });

    await client.deliveryTicketLineItem.update({
      where: { id: line.id },
      data: { status: "DELIVERED" },
    });
  }
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

  const qty = new Prisma.Decimal(input.quantityChange);
  const transactionDate = input.transactionDate ?? new Date();

  await client.$transaction(async (tx) => {
    // Read inside the transaction so validation and the atomic balance update
    // see a consistent view.
    const product = await tx.product.findUnique({
      where: { id: input.productId },
      select: { id: true, trackInventory: true },
    });

    if (!product) {
      throw new Error("Product not found.");
    }

    if (!product.trackInventory) {
      throw new Error("Product is not tracked in inventory.");
    }

    await applyStockChange(tx, {
      productId: input.productId,
      quantityChange: qty,
      transactionType: "ADJUSTMENT",
      transactionDate,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
    });
  });
}

/**
 * Reverse stock deductions when a delivered ticket is cancelled.
 */
export async function reverseInventoryForTicket(
  client: DbClient,
  deliveryTicketId: string,
  transactionDate: Date,
  createdBy?: string | null,
): Promise<void> {
  const lineItemIds = (
    await client.deliveryTicketLineItem.findMany({
      where: { deliveryTicketId },
      select: { id: true },
    })
  ).map((l) => l.id);

  const [deliveries, reversals] = await Promise.all([
    client.inventoryTransaction.findMany({
      where: {
        referenceType: "DELIVERY_TICKET_LINE_ITEM",
        transactionType: "DELIVERY",
        referenceId: { in: lineItemIds },
      },
    }),
    client.inventoryTransaction.findMany({
      where: {
        referenceType: "DELIVERY_TICKET_LINE_ITEM",
        transactionType: "REVERSAL",
        referenceId: { in: lineItemIds },
      },
      select: { referenceId: true },
    }),
  ]);

  // Skip line items already reversed so re-running this after a partial
  // failure (e.g. the ticket status update fails after reversal) doesn't
  // double-credit stock.
  const reversedIds = new Set(reversals.map((r) => r.referenceId));
  const existing = deliveries.filter((txn) => !reversedIds.has(txn.referenceId));

  for (const txn of existing) {
    const reversalQty = txn.quantityChange.mul(-1);

    await applyStockChange(client, {
      productId: txn.productId,
      quantityChange: reversalQty,
      transactionType: "REVERSAL",
      transactionDate,
      referenceType: txn.referenceType,
      referenceId: txn.referenceId,
      notes: `Reversal of delivery ticket ${deliveryTicketId}`,
      createdBy: createdBy ?? null,
      allowNegative: true,
    });
  }
}
