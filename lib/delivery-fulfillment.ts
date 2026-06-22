import type { PrismaClient } from "@/app/generated/prisma/client";
import type { QuoteLineType } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";
import {
  deductInventoryForDeliveredTicket,
  reverseInventoryForTicket,
} from "@/lib/inventory-service";
import {
  formatDrainRingStyleLabel,
  type DrainRingStyle,
} from "@/lib/drain-ring-utils";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type DrainRingOption = {
  productId: string;
  productCode: string;
  name: string;
  heightFeet: number;
  drainRingStyle: DrainRingStyle;
  weightEach: number | null;
  currentStock: number | null;
  trackInventory: boolean;
};

export type QuoteLineFulfillment = {
  quoteLineItemId: string;
  lineNumber: number;
  lineType: QuoteLineType;
  itemCode: string;
  description: string | null;
  displayName: string;
  unit: string;
  weightEach: number | null;
  quotedQty: number;
  shippedQty: number;
  remainingQty: number;
  eligible: boolean;
  eligibilityReason: string | null;
  jobStructureId: string | null;
  jobStructureStatus: string | null;
  productId: string | null;
  currentStock: number | null;
  isDrainRing: boolean;
  ringDiameterFeet: number | null;
  poolHeightFeet: number | null;
  drainRingStyle: DrainRingStyle;
  drainRingOptions: DrainRingOption[];
};

function resolveDisplayName(line: {
  itemCode: string;
  description: string | null;
  product: { name: string } | null;
  jobStructure: { description: string | null; structureNumber: string | null } | null;
}): string {
  if (line.product?.name) {
    return line.product.name;
  }
  if (line.jobStructure?.description?.trim()) {
    return line.jobStructure.description.trim();
  }
  if (line.jobStructure?.structureNumber?.trim()) {
    return line.jobStructure.structureNumber.trim();
  }
  if (line.description?.trim()) {
    return line.description.trim();
  }
  return line.itemCode;
}

function resolveWeightEach(line: {
  weight: { toString(): string } | null;
  product: { weight: { toString(): string } | null } | null;
  jobStructure: { weight: { toString(): string } | null } | null;
}): number | null {
  if (line.weight != null) {
    return Number(line.weight);
  }
  if (line.product?.weight != null) {
    return Number(line.product.weight);
  }
  if (line.jobStructure?.weight != null) {
    return Number(line.jobStructure.weight);
  }
  return null;
}

export async function getShippedQuantityForQuoteLine(
  client: DbClient,
  quoteLineItemId: string,
  excludeTicketId?: string,
): Promise<Prisma.Decimal> {
  const quantities = await loadShippedQuantitiesByQuoteLineId(
    client,
    [quoteLineItemId],
    excludeTicketId,
  );
  return quantities.get(quoteLineItemId) ?? new Prisma.Decimal(0);
}

/**
 * Feet shipped against a drain-ring quote line: sum of ring height x count
 * across DELIVERED tickets. Each delivery line is an individual ring SKU.
 */
export async function getShippedFeetForDrainRingLine(
  client: DbClient,
  quoteLineItemId: string,
  excludeTicketId?: string,
): Promise<number> {
  const feetByLineId = await loadShippedFeetByQuoteLineId(
    client,
    [quoteLineItemId],
    excludeTicketId,
  );
  return feetByLineId.get(quoteLineItemId) ?? 0;
}

async function loadShippedQuantitiesByQuoteLineId(
  client: DbClient,
  quoteLineItemIds: string[],
  excludeTicketId?: string,
): Promise<Map<string, Prisma.Decimal>> {
  if (quoteLineItemIds.length === 0) {
    return new Map();
  }

  const lines = await client.deliveryTicketLineItem.findMany({
    where: {
      quoteLineItemId: { in: quoteLineItemIds },
      deliveryTicket: {
        status: "DELIVERED",
        ...(excludeTicketId ? { id: { not: excludeTicketId } } : {}),
      },
    },
    select: { quoteLineItemId: true, quantity: true },
  });

  const totals = new Map<string, Prisma.Decimal>();
  for (const line of lines) {
    if (!line.quoteLineItemId) {
      continue;
    }
    const current = totals.get(line.quoteLineItemId) ?? new Prisma.Decimal(0);
    totals.set(line.quoteLineItemId, current.add(line.quantity));
  }

  return totals;
}

async function loadShippedFeetByQuoteLineId(
  client: DbClient,
  quoteLineItemIds: string[],
  excludeTicketId?: string,
): Promise<Map<string, number>> {
  if (quoteLineItemIds.length === 0) {
    return new Map();
  }

  const lines = await client.deliveryTicketLineItem.findMany({
    where: {
      quoteLineItemId: { in: quoteLineItemIds },
      deliveryTicket: {
        status: "DELIVERED",
        ...(excludeTicketId ? { id: { not: excludeTicketId } } : {}),
      },
    },
    select: {
      quoteLineItemId: true,
      quantity: true,
      product: { select: { heightFeet: true } },
    },
  });

  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.quoteLineItemId) {
      continue;
    }
    const heightFeet = line.product?.heightFeet
      ? Number(line.product.heightFeet)
      : 0;
    const current = totals.get(line.quoteLineItemId) ?? 0;
    totals.set(
      line.quoteLineItemId,
      current + heightFeet * Number(line.quantity),
    );
  }

  return totals;
}

function drainRingCatalogKey(
  ringDiameterFeet: Prisma.Decimal | null,
  drainRingStyle: DrainRingStyle,
): string {
  return `${ringDiameterFeet?.toString() ?? ""}:${drainRingStyle}`;
}

function isQuoteLineDrainRing(line: {
  isDrainRing: boolean;
  ringDiameterFeet: Prisma.Decimal | null;
  poolHeightFeet: Prisma.Decimal | null;
  productId: string | null;
}): boolean {
  return (
    line.isDrainRing ||
    (line.ringDiameterFeet != null &&
      line.poolHeightFeet != null &&
      line.productId == null)
  );
}

async function loadDrainRingCatalogByLine(
  client: DbClient,
  drainRingLines: Array<{
    ringDiameterFeet: Prisma.Decimal | null;
    drainRingStyle: string | null;
  }>,
): Promise<Map<string, DrainRingOption[]>> {
  const combos = new Map<
    string,
    { ringDiameterFeet: Prisma.Decimal; drainRingStyle: DrainRingStyle }
  >();

  for (const line of drainRingLines) {
    if (!line.ringDiameterFeet) {
      continue;
    }
    const drainRingStyle = (line.drainRingStyle ?? "DRAIN") as DrainRingStyle;
    combos.set(drainRingCatalogKey(line.ringDiameterFeet, drainRingStyle), {
      ringDiameterFeet: line.ringDiameterFeet,
      drainRingStyle,
    });
  }

  if (combos.size === 0) {
    return new Map();
  }

  const ringProducts = await client.product.findMany({
    where: {
      isDrainRing: true,
      status: "ACTIVE",
      OR: [...combos.values()].map((combo) => ({
        ringDiameterFeet: combo.ringDiameterFeet,
        drainRingStyle: combo.drainRingStyle,
      })),
    },
    orderBy: { heightFeet: "asc" },
    select: {
      id: true,
      productCode: true,
      name: true,
      heightFeet: true,
      drainRingStyle: true,
      ringDiameterFeet: true,
      weight: true,
      currentStockQuantity: true,
      trackInventory: true,
    },
  });

  const catalog = new Map<string, DrainRingOption[]>();
  for (const product of ringProducts) {
    if (product.heightFeet == null || product.ringDiameterFeet == null) {
      continue;
    }
    const key = drainRingCatalogKey(
      product.ringDiameterFeet,
      product.drainRingStyle as DrainRingStyle,
    );
    const options = catalog.get(key) ?? [];
    options.push({
      productId: product.id,
      productCode: product.productCode,
      name: product.name,
      heightFeet: Number(product.heightFeet),
      drainRingStyle: product.drainRingStyle as DrainRingStyle,
      weightEach: product.weight != null ? Number(product.weight) : null,
      currentStock: product.trackInventory
        ? product.currentStockQuantity
        : null,
      trackInventory: product.trackInventory,
    });
    catalog.set(key, options);
  }

  return catalog;
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
          product: {
            select: {
              id: true,
              name: true,
              weight: true,
              currentStockQuantity: true,
              trackInventory: true,
            },
          },
          jobStructure: {
            select: {
              id: true,
              status: true,
              description: true,
              structureNumber: true,
              weight: true,
            },
          },
        },
      },
    },
  });

  if (!quote) {
    return [];
  }

  const lineIds = quote.lineItems.map((line) => line.id);
  const drainRingLines = quote.lineItems.filter((line) => isQuoteLineDrainRing(line));
  const standardLineIds = quote.lineItems
    .filter((line) => !isQuoteLineDrainRing(line))
    .map((line) => line.id);

  const [shippedQuantities, shippedFeet, drainRingCatalog] = await Promise.all([
    loadShippedQuantitiesByQuoteLineId(client, standardLineIds, excludeTicketId),
    loadShippedFeetByQuoteLineId(client, lineIds, excludeTicketId),
    loadDrainRingCatalogByLine(client, drainRingLines),
  ]);

  const result: QuoteLineFulfillment[] = [];

  for (const line of quote.lineItems) {
    if (isQuoteLineDrainRing(line)) {
      const diameter = line.ringDiameterFeet
        ? Number(line.ringDiameterFeet)
        : null;
      const drainRingStyle = (line.drainRingStyle ?? "DRAIN") as DrainRingStyle;

      const drainRingOptions =
        drainRingCatalog.get(
          drainRingCatalogKey(line.ringDiameterFeet, drainRingStyle),
        ) ?? [];

      const quotedQty = Number(line.quantity);
      const shippedQty = shippedFeet.get(line.id) ?? 0;
      const remainingQty = Math.max(0, quotedQty - shippedQty);

      let eligible = remainingQty > 0;
      let eligibilityReason: string | null = null;
      if (remainingQty <= 0) {
        eligible = false;
        eligibilityReason = "Fully shipped";
      } else if (drainRingOptions.length === 0) {
        eligible = false;
        eligibilityReason = diameter
          ? `No active ${diameter}' ${formatDrainRingStyleLabel(drainRingStyle).toLowerCase()} rings in catalog`
          : "No ring diameter set";
      } else {
        const hasStock = drainRingOptions.some(
          (option) =>
            !option.trackInventory ||
            (option.currentStock != null && option.currentStock > 0),
        );
        if (!hasStock) {
          eligible = true;
          eligibilityReason = "No rings in stock";
        }
      }

      result.push({
        quoteLineItemId: line.id,
        lineNumber: line.lineNumber,
        lineType: line.lineType,
        itemCode: line.itemCode,
        description: line.description,
        displayName: resolveDisplayName(line),
        unit: line.unit || "LF",
        weightEach: resolveWeightEach(line),
        quotedQty,
        shippedQty,
        remainingQty,
        eligible,
        eligibilityReason,
        jobStructureId: line.jobStructureId,
        jobStructureStatus: null,
        productId: null,
        currentStock: null,
        isDrainRing: true,
        ringDiameterFeet: diameter,
        poolHeightFeet: line.poolHeightFeet
          ? Number(line.poolHeightFeet)
          : null,
        drainRingStyle,
        drainRingOptions,
      });
      continue;
    }

    const shipped = shippedQuantities.get(line.id) ?? new Prisma.Decimal(0);
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
      displayName: resolveDisplayName(line),
      unit: line.unit,
      weightEach: resolveWeightEach(line),
      quotedQty,
      shippedQty,
      remainingQty,
      eligible,
      eligibilityReason,
      jobStructureId: line.jobStructureId,
      jobStructureStatus: line.jobStructure?.status ?? null,
      productId: line.productId,
      currentStock: line.product?.currentStockQuantity ?? null,
      isDrainRing: false,
      ringDiameterFeet: null,
      poolHeightFeet: null,
      drainRingStyle: "DRAIN",
      drainRingOptions: [],
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

    await deductInventoryForDeliveredTicket(
      tx,
      deliveryTicketId,
      deliveredAt,
      options?.verifiedBy,
    );
  });
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

  await client.$transaction(async (tx) => {
    await reverseInventoryForTicket(tx, deliveryTicketId, new Date());

    await tx.deliveryTicket.update({
      where: { id: deliveryTicketId },
      data: { status: "CANCELLED" },
    });
  });
}
