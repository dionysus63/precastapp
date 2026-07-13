import type {
  Prisma,
  PrismaClient,
  PurchaseOrderStatus,
  ReceivingCategory,
} from "@/app/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/app/generated/prisma/client";
import { allocatePurchaseOrderNumber } from "@/lib/purchase-order-number";
import {
  OPEN_PURCHASE_ORDER_STATUSES,
  canEditPurchaseOrder,
} from "@/lib/purchase-order-utils";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type PurchaseOrderLineInput = {
  productId?: string | null;
  itemCode: string;
  description?: string | null;
  quantityOrdered: number;
  unit?: string;
  unitPrice: number;
};

export type SavePurchaseOrderInput = {
  vendorId: string;
  category?: ReceivingCategory | null;
  orderDate: Date;
  expectedDate?: Date | null;
  notes?: string | null;
  enteredBy?: string | null;
  submissionKey?: string | null;
  lines: PurchaseOrderLineInput[];
};

function toDecimal(value: number): PrismaNamespace.Decimal {
  return new PrismaNamespace.Decimal(value);
}

function lineTotal(quantity: number, unitPrice: number): PrismaNamespace.Decimal {
  return toDecimal(quantity).mul(toDecimal(unitPrice));
}

export function computePurchaseOrderTotals(lines: PurchaseOrderLineInput[]) {
  let subtotal = new PrismaNamespace.Decimal(0);
  for (const line of lines) {
    subtotal = subtotal.add(lineTotal(line.quantityOrdered, line.unitPrice));
  }
  return {
    subtotal,
    total: subtotal,
  };
}

function validateLines(lines: PurchaseOrderLineInput[]): void {
  if (lines.length === 0) {
    throw new Error("Add at least one purchase order line.");
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.itemCode.trim()) {
      throw new Error(`Line ${index + 1}: item code is required.`);
    }
    if (!Number.isFinite(line.quantityOrdered) || line.quantityOrdered <= 0) {
      throw new Error(`Line ${index + 1}: quantity must be greater than zero.`);
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      throw new Error(`Line ${index + 1}: unit price cannot be negative.`);
    }
  }
}

export async function createPurchaseOrderRecord(
  tx: Prisma.TransactionClient,
  input: SavePurchaseOrderInput,
): Promise<string> {
  validateLines(input.lines);

  if (input.submissionKey) {
    const existing = await tx.purchaseOrder.findUnique({
      where: { submissionKey: input.submissionKey },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }
  }

  const vendor = await tx.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, status: true },
  });
  if (!vendor) {
    throw new Error("Vendor not found.");
  }
  if (vendor.status !== "ACTIVE") {
    throw new Error("Vendor is inactive.");
  }

  const { sequenceNumber, poNumber } = await allocatePurchaseOrderNumber(tx);
  const totals = computePurchaseOrderTotals(input.lines);

  const purchaseOrder = await tx.purchaseOrder.create({
    data: {
      poNumber,
      sequenceNumber,
      vendorId: input.vendorId,
      category: input.category ?? null,
      orderDate: input.orderDate,
      expectedDate: input.expectedDate ?? null,
      notes: input.notes ?? null,
      enteredBy: input.enteredBy ?? null,
      submissionKey: input.submissionKey ?? null,
      subtotal: totals.subtotal,
      total: totals.total,
      lines: {
        create: input.lines.map((line, index) => ({
          lineNumber: index + 1,
          productId: line.productId?.trim() || null,
          itemCode: line.itemCode.trim(),
          description: line.description?.trim() || null,
          quantityOrdered: toDecimal(line.quantityOrdered),
          unit: line.unit?.trim() || "EA",
          unitPrice: toDecimal(line.unitPrice),
          total: lineTotal(line.quantityOrdered, line.unitPrice),
          sortOrder: index,
        })),
      },
    },
    select: { id: true },
  });

  return purchaseOrder.id;
}

export async function updatePurchaseOrderRecord(
  tx: Prisma.TransactionClient,
  purchaseOrderId: string,
  input: SavePurchaseOrderInput,
  expectedUpdatedAt?: Date | null,
): Promise<void> {
  validateLines(input.lines);

  const existing = await tx.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: { id: true, status: true, updatedAt: true },
  });
  if (!existing) {
    throw new Error("Purchase order not found.");
  }
  if (!canEditPurchaseOrder(existing.status)) {
    throw new Error("This purchase order can no longer be edited.");
  }
  if (
    expectedUpdatedAt &&
    existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()
  ) {
    throw new Error(
      "This purchase order was changed by someone else. Refresh and try again.",
    );
  }

  const totals = computePurchaseOrderTotals(input.lines);

  await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId } });
  await tx.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: {
      vendorId: input.vendorId,
      category: input.category ?? null,
      orderDate: input.orderDate,
      expectedDate: input.expectedDate ?? null,
      notes: input.notes ?? null,
      enteredBy: input.enteredBy ?? null,
      subtotal: totals.subtotal,
      total: totals.total,
      lines: {
        create: input.lines.map((line, index) => ({
          lineNumber: index + 1,
          productId: line.productId?.trim() || null,
          itemCode: line.itemCode.trim(),
          description: line.description?.trim() || null,
          quantityOrdered: toDecimal(line.quantityOrdered),
          unit: line.unit?.trim() || "EA",
          unitPrice: toDecimal(line.unitPrice),
          total: lineTotal(line.quantityOrdered, line.unitPrice),
          sortOrder: index,
        })),
      },
    },
  });
}

export async function refreshPurchaseOrderStatus(
  tx: DbClient,
  purchaseOrderId: string,
): Promise<PurchaseOrderStatus> {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: {
      status: true,
      lines: {
        select: { quantityOrdered: true, quantityReceived: true },
      },
    },
  });

  if (!po) {
    throw new Error("Purchase order not found.");
  }

  if (po.status === "CANCELLED" || po.status === "DRAFT") {
    return po.status;
  }

  if (po.lines.length === 0) {
    return po.status;
  }

  let anyReceived = false;
  let allReceived = true;

  for (const line of po.lines) {
    const ordered = line.quantityOrdered.toNumber();
    const received = line.quantityReceived.toNumber();
    if (received > 0) {
      anyReceived = true;
    }
    if (received < ordered) {
      allReceived = false;
    }
  }

  let nextStatus: PurchaseOrderStatus = po.status;
  if (allReceived && anyReceived) {
    nextStatus = "RECEIVED";
  } else if (anyReceived) {
    nextStatus = "PARTIALLY_RECEIVED";
  } else if (po.status === "PARTIALLY_RECEIVED" || po.status === "RECEIVED") {
    nextStatus = "ISSUED";
  }

  if (nextStatus !== po.status) {
    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: nextStatus },
    });
  }

  return nextStatus;
}

export type ReceiptLineForPo = {
  productId: string;
  quantityReceived: number;
};

export async function applyReceiptToPurchaseOrder(
  tx: DbClient,
  purchaseOrderId: string,
  receiptLines: ReceiptLineForPo[],
): Promise<void> {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      lines: { orderBy: [{ sortOrder: "asc" }, { lineNumber: "asc" }] },
    },
  });

  if (!po) {
    throw new Error("Purchase order not found.");
  }

  if (po.status === "CANCELLED" || po.status === "DRAFT") {
    throw new Error("Issue the purchase order before receiving against it.");
  }

  const openLinesByProduct = new Map<string, typeof po.lines>();
  for (const line of po.lines) {
    if (!line.productId) {
      continue;
    }
    const bucket = openLinesByProduct.get(line.productId) ?? [];
    bucket.push(line);
    openLinesByProduct.set(line.productId, bucket);
  }

  // Quantities applied in this call, per PO line — the `po.lines` snapshot
  // above goes stale as soon as we start incrementing.
  const appliedByLineId = new Map<string, number>();

  for (const receiptLine of receiptLines) {
    const candidates = openLinesByProduct.get(receiptLine.productId);
    if (!candidates || candidates.length === 0) {
      // Product isn't on this PO: the receipt still posts to inventory; it
      // just doesn't advance PO progress.
      continue;
    }

    // Fill each matching line up to its ordered quantity, in line order.
    // Anything left after all lines are full is an over-receipt and lands on
    // the last line, where it shows as e.g. 15/10 instead of inflating the
    // first line while later lines sit untouched at 0.
    let remaining = receiptLine.quantityReceived;
    for (let index = 0; index < candidates.length; index += 1) {
      if (remaining <= 0) {
        break;
      }
      const poLine = candidates[index]!;
      const lineOpen =
        Number(poLine.quantityOrdered) -
        Number(poLine.quantityReceived) -
        (appliedByLineId.get(poLine.id) ?? 0);
      const isLastCandidate = index === candidates.length - 1;
      const applied = isLastCandidate
        ? remaining
        : Math.min(remaining, Math.max(lineOpen, 0));
      if (applied <= 0) {
        continue;
      }

      await tx.purchaseOrderLine.update({
        where: { id: poLine.id },
        data: {
          quantityReceived: {
            increment: toDecimal(applied),
          },
        },
      });
      appliedByLineId.set(poLine.id, (appliedByLineId.get(poLine.id) ?? 0) + applied);
      remaining -= applied;
    }
  }

  await refreshPurchaseOrderStatus(tx, purchaseOrderId);
}

export async function listOpenPurchaseOrders(
  client: DbClient,
  category?: ReceivingCategory | null,
) {
  return client.purchaseOrder.findMany({
    where: {
      status: { in: OPEN_PURCHASE_ORDER_STATUSES },
      ...(category ? { category } : {}),
    },
    orderBy: [{ orderDate: "desc" }, { poNumber: "desc" }],
    select: {
      id: true,
      poNumber: true,
      vendor: { select: { name: true } },
      category: true,
      orderDate: true,
      status: true,
      lines: {
        select: {
          id: true,
          productId: true,
          itemCode: true,
          description: true,
          quantityOrdered: true,
          quantityReceived: true,
          unit: true,
        },
      },
    },
  });
}
