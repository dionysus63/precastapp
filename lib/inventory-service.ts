import type {
  InventoryReferenceType,
  InventoryTransactionType,
  PrismaClient,
  ReceivingCategory,
} from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ProductionLineInput = {
  productId: string;
  quantityProduced: number;
};

export type StructureProductionLineInput = {
  jobStructureId: string;
  /** Set when recording a specific piece of a split structure (qty is 1). */
  jobStructurePieceId?: string | null;
  quantityMade: number;
};

export type PurchaseReceiptLineInput = {
  productId: string;
  quantityReceived: number;
};

/** True for a P2002 on a submissionKey column: the same form submission
 * already landed (double-click / retry). Callers should treat it as success. */
export function isDuplicateSubmission(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("submissionKey");
  }
  return typeof target === "string" && target.includes("submissionKey");
}

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
  /** Idempotency key for user-submitted changes (see schema). */
  submissionKey?: string | null;
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
  // Stock is tracked in whole units (Int balance). Reject fractional ledger
  // magnitudes outright instead of rounding: a silent round would make the
  // Decimal ledger and the Int balance permanently disagree.
  const balanceDelta = input.quantityChange.toNumber();
  if (!Number.isInteger(balanceDelta)) {
    throw new Error(
      `Stock is tracked in whole units; got a quantity of ${input.quantityChange.toString()}.`,
    );
  }

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
      submissionKey: input.submissionKey ?? null,
    },
  });

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

type InboundStockChange = Omit<StockChangeInput, "allowNegative">;

/**
 * Batched variant of {@link applyStockChange} for inbound-only changes
 * (receipts, production): one ledger `createMany` plus one balance update per
 * distinct product, instead of two round-trips per line. Inbound changes only
 * increase stock, so the negative-balance guard is not needed. Must be called
 * inside a `$transaction`.
 */
async function applyInboundStockChanges(
  tx: DbClient,
  changes: InboundStockChange[],
): Promise<void> {
  if (changes.length === 0) {
    return;
  }

  const deltaByProduct = new Map<string, number>();
  for (const change of changes) {
    // Same whole-unit rule as applyStockChange: reject fractional magnitudes
    // so the Decimal ledger and the Int balance never disagree.
    const balanceDelta = change.quantityChange.toNumber();
    if (!Number.isInteger(balanceDelta)) {
      throw new Error(
        `Stock is tracked in whole units; got a quantity of ${change.quantityChange.toString()}.`,
      );
    }
    deltaByProduct.set(
      change.productId,
      (deltaByProduct.get(change.productId) ?? 0) + balanceDelta,
    );
  }

  await tx.inventoryTransaction.createMany({
    data: changes.map((change) => ({
      productId: change.productId,
      quantityChange: change.quantityChange,
      transactionType: change.transactionType,
      transactionDate: change.transactionDate,
      referenceType: change.referenceType ?? null,
      referenceId: change.referenceId ?? null,
      notes: change.notes ?? null,
      createdBy: change.createdBy ?? null,
      submissionKey: change.submissionKey ?? null,
    })),
  });

  for (const [productId, delta] of deltaByProduct) {
    await tx.product.update({
      where: { id: productId },
      data: { currentStockQuantity: { increment: delta } },
    });
  }
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
    category?: ReceivingCategory | null;
    supplierId?: string | null;
    purchaseOrderId?: string | null;
    enteredBy?: string | null;
    notes?: string | null;
    batchLabel?: string | null;
    submissionKey?: string | null;
    lines: PurchaseReceiptLineInput[];
  },
): Promise<string> {
  if (input.lines.length === 0) {
    throw new Error("Add at least one receipt line.");
  }

  // Idempotency: a resubmitted form (double-click, retry after timeout)
  // reuses its key, so the receipt is only posted once. The @unique on
  // submissionKey is the backstop for two truly concurrent submissions.
  if (input.submissionKey) {
    const existing = await tx.purchaseReceiptEntry.findUnique({
      where: { submissionKey: input.submissionKey },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }
  }

  const entry = await tx.purchaseReceiptEntry.create({
    data: {
      receiptDate: input.receiptDate,
      category: input.category ?? null,
      supplierId: input.supplierId ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      enteredBy: input.enteredBy ?? null,
      notes: input.notes ?? null,
      batchLabel: input.batchLabel ?? null,
      submissionKey: input.submissionKey ?? null,
    },
  });

  // One validation read for the whole entry instead of one per line: large
  // entries otherwise risk the transaction timeout on sequential round-trips.
  const products = await tx.product.findMany({
    where: { id: { in: [...new Set(input.lines.map((line) => line.productId))] } },
    select: {
      id: true,
      trackInventory: true,
      castingRole: true,
      castingSoldAsUnit: true,
    },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  for (const line of input.lines) {
    const product = productById.get(line.productId);

    if (!product) {
      throw new Error("Product not found.");
    }

    if (!product.trackInventory) {
      throw new Error("Product is not tracked in inventory.");
    }

    if (product.castingRole === "ASSEMBLY" && !product.castingSoldAsUnit) {
      throw new Error("Receive component pieces, not casting assemblies.");
    }

    if (new Prisma.Decimal(line.quantityReceived).lte(0)) {
      throw new Error("Quantity received must be greater than zero.");
    }
  }

  const receiptLines = await tx.purchaseReceiptLine.createManyAndReturn({
    data: input.lines.map((line) => ({
      purchaseReceiptId: entry.id,
      productId: line.productId,
      quantityReceived: new Prisma.Decimal(line.quantityReceived),
    })),
    select: { id: true, productId: true, quantityReceived: true },
  });

  await applyInboundStockChanges(
    tx,
    receiptLines.map((receiptLine) => ({
      productId: receiptLine.productId,
      quantityChange: receiptLine.quantityReceived,
      transactionType: "PURCHASE_RECEIPT" as const,
      transactionDate: input.receiptDate,
      referenceType: "PURCHASE_RECEIPT_LINE" as const,
      referenceId: receiptLine.id,
      createdBy: input.enteredBy ?? null,
    })),
  );

  if (input.purchaseOrderId) {
    const { applyReceiptToPurchaseOrder } = await import(
      "@/lib/purchase-order-service"
    );
    await applyReceiptToPurchaseOrder(
      tx,
      input.purchaseOrderId,
      receiptLines.map((line) => ({
        productId: line.productId,
        quantityReceived: line.quantityReceived.toNumber(),
      })),
    );
  }

  return entry.id;
}

/**
 * Record daily production. Stock lines post to the inventory ledger (+qty,
 * bump Product.currentStockQuantity); structure lines log made progress
 * against in-production job structures and flip a structure to MADE when its
 * cumulative made count reaches its quantity (or all its pieces are made).
 */
export async function saveDailyProductionEntry(
  client: PrismaClient,
  input: {
    productionDate: Date;
    enteredBy?: string | null;
    notes?: string | null;
    batchLabel?: string | null;
    submissionKey?: string | null;
    lines: ProductionLineInput[];
    structureLines?: StructureProductionLineInput[];
  },
): Promise<string> {
  const structureLines = input.structureLines ?? [];
  if (input.lines.length === 0 && structureLines.length === 0) {
    throw new Error("Add at least one production line.");
  }

  return client.$transaction(
    async (tx) => {
      // Idempotency: see savePurchaseReceiptEntry.
      if (input.submissionKey) {
        const existing = await tx.dailyProductionEntry.findUnique({
          where: { submissionKey: input.submissionKey },
          select: { id: true },
        });
        if (existing) {
          return existing.id;
        }
      }

      const entry = await tx.dailyProductionEntry.create({
        data: {
          productionDate: input.productionDate,
          enteredBy: input.enteredBy ?? null,
          notes: input.notes ?? null,
          batchLabel: input.batchLabel ?? null,
          submissionKey: input.submissionKey ?? null,
        },
      });

      if (input.lines.length > 0) {
        // Batched like savePurchaseReceiptEntry: one validation read, one line
        // createMany, one ledger createMany, one balance update per product.
        const products = await tx.product.findMany({
          where: {
            id: { in: [...new Set(input.lines.map((line) => line.productId))] },
          },
          select: { id: true, trackInventory: true },
        });
        const productById = new Map(
          products.map((product) => [product.id, product]),
        );

        for (const line of input.lines) {
          const product = productById.get(line.productId);

          if (!product) {
            throw new Error("Product not found.");
          }

          if (!product.trackInventory) {
            throw new Error("Product is not tracked in inventory.");
          }

          if (new Prisma.Decimal(line.quantityProduced).lte(0)) {
            throw new Error("Quantity produced must be greater than zero.");
          }
        }

        const productionLines = await tx.dailyProductionLine.createManyAndReturn({
          data: input.lines.map((line) => ({
            productionEntryId: entry.id,
            productId: line.productId,
            quantityProduced: new Prisma.Decimal(line.quantityProduced),
          })),
          select: { id: true, productId: true, quantityProduced: true },
        });

        await applyInboundStockChanges(
          tx,
          productionLines.map((productionLine) => ({
            productId: productionLine.productId,
            quantityChange: productionLine.quantityProduced,
            transactionType: "PRODUCTION" as const,
            transactionDate: input.productionDate,
            referenceType: "DAILY_PRODUCTION_LINE" as const,
            referenceId: productionLine.id,
            createdBy: input.enteredBy ?? null,
          })),
        );
      }

      if (structureLines.length > 0) {
        await applyStructureProductionLines(
          tx,
          entry.id,
          input.productionDate,
          structureLines,
        );
      }

      return entry.id;
    },
    // Generous ceiling for big production days; the batched writes above keep
    // normal entries far under it.
    { timeout: 30_000 },
  );
}

/**
 * Log made progress for job structures and flip completed ones to MADE.
 * Piece lines mark their piece's madeDate; a split structure is MADE when
 * every piece is made. Quantity lines accumulate; a structure is MADE when
 * the all-time made sum reaches its quantity. Over-production is allowed
 * (the log records reality) but a structure is never demoted.
 */
async function applyStructureProductionLines(
  tx: Prisma.TransactionClient,
  productionEntryId: string,
  productionDate: Date,
  lines: StructureProductionLineInput[],
): Promise<void> {
  const structureIds = [...new Set(lines.map((line) => line.jobStructureId))];
  const structures = await tx.jobStructure.findMany({
    where: { id: { in: structureIds } },
    select: {
      id: true,
      structureNumber: true,
      status: true,
      quantity: true,
      pieces: { select: { id: true, madeDate: true } },
    },
  });
  const structureById = new Map(structures.map((row) => [row.id, row]));

  const pieceIdsToMark: string[] = [];
  for (const line of lines) {
    const structure = structureById.get(line.jobStructureId);
    if (!structure) {
      throw new Error("Structure was not found.");
    }
    const label = structure.structureNumber ?? "Structure";
    if (structure.status !== "IN_PRODUCTION") {
      throw new Error(`${label} is not in production.`);
    }
    if (line.jobStructurePieceId) {
      const piece = structure.pieces.find(
        (candidate) => candidate.id === line.jobStructurePieceId,
      );
      if (!piece) {
        throw new Error(`${label}: piece not found on this structure.`);
      }
      if (piece.madeDate) {
        throw new Error(`${label}: that piece is already recorded as made.`);
      }
      pieceIdsToMark.push(piece.id);
    } else {
      if (structure.pieces.length > 0) {
        throw new Error(
          `${label} is split into pieces — record the individual pieces instead.`,
        );
      }
      if (!Number.isFinite(line.quantityMade) || line.quantityMade <= 0) {
        throw new Error(`${label}: quantity made must be a positive number.`);
      }
    }
  }

  await tx.dailyProductionStructureLine.createMany({
    data: lines.map((line) => ({
      productionEntryId,
      jobStructureId: line.jobStructureId,
      jobStructurePieceId: line.jobStructurePieceId ?? null,
      quantityMade: new Prisma.Decimal(
        line.jobStructurePieceId ? 1 : line.quantityMade,
      ),
    })),
  });

  if (pieceIdsToMark.length > 0) {
    await tx.jobStructurePiece.updateMany({
      where: { id: { in: pieceIdsToMark } },
      data: { madeDate: productionDate },
    });
  }

  // Completion check per structure, from the durable log — never a counter.
  for (const structure of structures) {
    let complete: boolean;
    if (structure.pieces.length > 0) {
      const unmade = await tx.jobStructurePiece.count({
        where: { jobStructureId: structure.id, madeDate: null },
      });
      complete = unmade === 0;
    } else {
      const madeSoFar = await tx.dailyProductionStructureLine.aggregate({
        where: { jobStructureId: structure.id },
        _sum: { quantityMade: true },
      });
      const total = madeSoFar._sum.quantityMade ?? new Prisma.Decimal(0);
      complete =
        structure.quantity != null && total.gte(structure.quantity);
    }
    if (complete) {
      await tx.jobStructure.update({
        where: { id: structure.id },
        data: { status: "MADE", madeDate: productionDate },
      });
    }
  }
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
          product: {
            select: {
              id: true,
              trackInventory: true,
              castingRole: true,
              castingSoldAsUnit: true,
              // Parts-mode assemblies aren't stocked themselves — delivering
              // one set consumes each tracked component.
              castingAssemblyComponents: {
                select: {
                  componentId: true,
                  quantity: true,
                  component: { select: { trackInventory: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    throw new Error("Delivery ticket not found.");
  }

  for (const line of ticket.lineItems) {
    if (!line.productId || !line.product) {
      continue;
    }

    // Idempotency guard: a line already marked DELIVERED has already been
    // deducted. Skip it so concurrent / repeated marks don't double-deduct.
    if (line.status === "DELIVERED") {
      continue;
    }

    const isPartsAssembly =
      line.product.castingRole === "ASSEMBLY" &&
      !line.product.castingSoldAsUnit &&
      line.product.castingAssemblyComponents.length > 0;

    if (isPartsAssembly) {
      // One assembly line (qty = sets) deducts every tracked component;
      // reversal replays these ledger entries, so it needs no special case.
      for (const bomRow of line.product.castingAssemblyComponents) {
        if (!bomRow.component.trackInventory) {
          continue;
        }
        await applyStockChange(client, {
          productId: bomRow.componentId,
          quantityChange: line.quantity.mul(-bomRow.quantity),
          transactionType: "DELIVERY",
          transactionDate: deliveredAt,
          referenceType: "DELIVERY_TICKET_LINE_ITEM",
          referenceId: line.id,
          createdBy: createdBy ?? null,
          allowNegative: true,
        });
      }
      await client.deliveryTicketLineItem.update({
        where: { id: line.id },
        data: { status: "DELIVERED" },
      });
      continue;
    }

    if (!line.product.trackInventory) {
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
    submissionKey?: string | null;
  },
): Promise<void> {
  if (!Number.isFinite(input.quantityChange) || input.quantityChange === 0) {
    throw new Error("Adjustment quantity cannot be zero.");
  }

  const qty = new Prisma.Decimal(input.quantityChange);
  const transactionDate = input.transactionDate ?? new Date();

  await client.$transaction(async (tx) => {
    // Idempotency: see savePurchaseReceiptEntry.
    if (input.submissionKey) {
      const existing = await tx.inventoryTransaction.findUnique({
        where: { submissionKey: input.submissionKey },
        select: { id: true },
      });
      if (existing) {
        return;
      }
    }

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
      submissionKey: input.submissionKey ?? null,
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

  // Sequential awaits: `client` may be a transaction client, which is pinned
  // to a single pg connection — concurrent queries on it are unsupported
  // (deprecated in pg 8, removed in pg 9).
  const deliveries = await client.inventoryTransaction.findMany({
    where: {
      referenceType: "DELIVERY_TICKET_LINE_ITEM",
      transactionType: "DELIVERY",
      referenceId: { in: lineItemIds },
    },
  });
  const reversals = await client.inventoryTransaction.findMany({
    where: {
      referenceType: "DELIVERY_TICKET_LINE_ITEM",
      transactionType: "REVERSAL",
      referenceId: { in: lineItemIds },
    },
    select: { referenceId: true },
  });

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
