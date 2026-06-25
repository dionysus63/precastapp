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
import {
  formatCastingPieceRoleLabel,
  type CastingComponentOption,
  type CastingPieceRole,
} from "@/lib/casting-utils";
import { loadCastingComponentOptionsForAssembly } from "@/lib/casting-service";

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
  isCastingAssembly: boolean;
  castingComponentOptions: CastingComponentOption[];
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

/** Walk previousLineItemId chains; map each current line id to [self, ...ancestors]. */
async function buildQuoteLineLineageMap(
  client: DbClient,
  currentLineIds: string[],
): Promise<Map<string, string[]>> {
  if (currentLineIds.length === 0) {
    return new Map();
  }

  const prevById = new Map<string, string | null>();
  const pending = new Set(currentLineIds);

  while (pending.size > 0) {
    const batch = [...pending];
    pending.clear();

    const rows = await client.quoteLineItem.findMany({
      where: { id: { in: batch } },
      select: { id: true, previousLineItemId: true },
    });

    for (const row of rows) {
      prevById.set(row.id, row.previousLineItemId);
      if (row.previousLineItemId && !prevById.has(row.previousLineItemId)) {
        pending.add(row.previousLineItemId);
      }
    }
  }

  const lineage = new Map<string, string[]>();
  for (const lineId of currentLineIds) {
    const chain: string[] = [];
    const seen = new Set<string>();
    let current: string | null = lineId;
    while (current && !seen.has(current)) {
      seen.add(current);
      chain.push(current);
      current = prevById.get(current) ?? null;
    }
    lineage.set(lineId, chain);
  }

  return lineage;
}

function allLineageIds(lineageMap: Map<string, string[]>): string[] {
  return [...new Set([...lineageMap.values()].flat())];
}

function rollUpDecimalTotals(
  lineageMap: Map<string, string[]>,
  rawTotals: Map<string, Prisma.Decimal>,
): Map<string, Prisma.Decimal> {
  const rolled = new Map<string, Prisma.Decimal>();
  for (const [currentId, chain] of lineageMap) {
    let sum = new Prisma.Decimal(0);
    for (const id of chain) {
      sum = sum.add(rawTotals.get(id) ?? new Prisma.Decimal(0));
    }
    rolled.set(currentId, sum);
  }
  return rolled;
}

function rollUpNumberTotals(
  lineageMap: Map<string, string[]>,
  rawTotals: Map<string, number>,
): Map<string, number> {
  const rolled = new Map<string, number>();
  for (const [currentId, chain] of lineageMap) {
    let sum = 0;
    for (const id of chain) {
      sum += rawTotals.get(id) ?? 0;
    }
    rolled.set(currentId, sum);
  }
  return rolled;
}

export async function getShippedQuantityForQuoteLine(
  client: DbClient,
  quoteLineItemId: string,
  excludeTicketId?: string,
): Promise<Prisma.Decimal> {
  const lineageMap = await buildQuoteLineLineageMap(client, [quoteLineItemId]);
  const quantities = await loadShippedQuantitiesByQuoteLineId(
    client,
    lineageMap,
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
  const lineageMap = await buildQuoteLineLineageMap(client, [quoteLineItemId]);
  const feetByLineId = await loadShippedFeetByQuoteLineId(
    client,
    lineageMap,
    excludeTicketId,
  );
  return feetByLineId.get(quoteLineItemId) ?? 0;
}

async function loadShippedQuantitiesByQuoteLineId(
  client: DbClient,
  lineageMap: Map<string, string[]>,
  excludeTicketId?: string,
): Promise<Map<string, Prisma.Decimal>> {
  const quoteLineItemIds = allLineageIds(lineageMap);
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

  const rawTotals = new Map<string, Prisma.Decimal>();
  for (const line of lines) {
    if (!line.quoteLineItemId) {
      continue;
    }
    const current = rawTotals.get(line.quoteLineItemId) ?? new Prisma.Decimal(0);
    rawTotals.set(line.quoteLineItemId, current.add(line.quantity));
  }

  return rollUpDecimalTotals(lineageMap, rawTotals);
}

async function loadShippedFeetByQuoteLineId(
  client: DbClient,
  lineageMap: Map<string, string[]>,
  excludeTicketId?: string,
): Promise<Map<string, number>> {
  const quoteLineItemIds = allLineageIds(lineageMap);
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

  const rawTotals = new Map<string, number>();
  for (const line of lines) {
    if (!line.quoteLineItemId) {
      continue;
    }
    const heightFeet = line.product?.heightFeet
      ? Number(line.product.heightFeet)
      : 0;
    const current = rawTotals.get(line.quoteLineItemId) ?? 0;
    rawTotals.set(
      line.quoteLineItemId,
      current + heightFeet * Number(line.quantity),
    );
  }

  return rollUpNumberTotals(lineageMap, rawTotals);
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

function isQuoteLineCastingAssembly(line: {
  productId: string | null;
  product?: { castingRole?: string | null } | null;
}): boolean {
  return line.product?.castingRole === "ASSEMBLY";
}

async function loadShippedCastingSetsByQuoteLineId(
  client: DbClient,
  castingLines: Array<{
    id: string;
    productId: string | null;
  }>,
  lineageMap: Map<string, string[]>,
  excludeTicketId?: string,
): Promise<Map<string, number>> {
  if (castingLines.length === 0) {
    return new Map();
  }

  const lineIds = allLineageIds(
    new Map(
      castingLines.map((line) => [line.id, lineageMap.get(line.id) ?? [line.id]]),
    ),
  );
  const assemblyIds = [
    ...new Set(
      castingLines
        .map((line) => line.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [deliveryLines, bomRows] = await Promise.all([
    client.deliveryTicketLineItem.findMany({
      where: {
        quoteLineItemId: { in: lineIds },
        deliveryTicket: {
          status: "DELIVERED",
          ...(excludeTicketId ? { id: { not: excludeTicketId } } : {}),
        },
      },
      select: {
        quoteLineItemId: true,
        quantity: true,
        productId: true,
      },
    }),
    client.productCastingComponent.findMany({
      where: { assemblyId: { in: assemblyIds } },
      select: {
        assemblyId: true,
        componentId: true,
        pieceRole: true,
        quantity: true,
      },
    }),
  ]);

  const bomByAssembly = new Map<
    string,
    Array<{ componentId: string; pieceRole: CastingPieceRole; quantity: number }>
  >();
  for (const row of bomRows) {
    const items = bomByAssembly.get(row.assemblyId) ?? [];
    items.push({
      componentId: row.componentId,
      pieceRole: row.pieceRole,
      quantity: row.quantity,
    });
    bomByAssembly.set(row.assemblyId, items);
  }

  const totals = new Map<string, number>();
  for (const line of castingLines) {
    if (!line.productId) {
      continue;
    }
    const bom = bomByAssembly.get(line.productId) ?? [];
    if (bom.length === 0) {
      totals.set(line.id, 0);
      continue;
    }

    const chain = lineageMap.get(line.id) ?? [line.id];
    const chainDeliveries = deliveryLines.filter(
      (entry) =>
        entry.quoteLineItemId != null &&
        chain.includes(entry.quoteLineItemId),
    );

    const shippedByComponent = new Map<string, number>();
    for (const entry of chainDeliveries) {
      if (!entry.productId) {
        continue;
      }
      shippedByComponent.set(
        entry.productId,
        (shippedByComponent.get(entry.productId) ?? 0) +
          Number(entry.quantity),
      );
    }

    let sets = Number.POSITIVE_INFINITY;
    for (const row of bom) {
      const shipped = shippedByComponent.get(row.componentId) ?? 0;
      sets = Math.min(sets, Math.floor(shipped / row.quantity));
    }
    totals.set(line.id, Number.isFinite(sets) ? sets : 0);
  }

  return totals;
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
              castingRole: true,
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
  const lineageMap = await buildQuoteLineLineageMap(client, lineIds);
  const drainRingLines = quote.lineItems.filter((line) => isQuoteLineDrainRing(line));
  const castingAssemblyLines = quote.lineItems.filter((line) =>
    isQuoteLineCastingAssembly(line),
  );
  const standardLineIds = quote.lineItems
    .filter(
      (line) =>
        !isQuoteLineDrainRing(line) && !isQuoteLineCastingAssembly(line),
    )
    .map((line) => line.id);

  const standardLineage = new Map<string, string[]>();
  for (const id of standardLineIds) {
    const chain = lineageMap.get(id);
    if (chain) {
      standardLineage.set(id, chain);
    }
  }

  const [shippedQuantities, shippedFeet, drainRingCatalog, shippedCastingSets] =
    await Promise.all([
      loadShippedQuantitiesByQuoteLineId(client, standardLineage, excludeTicketId),
      loadShippedFeetByQuoteLineId(client, lineageMap, excludeTicketId),
      loadDrainRingCatalogByLine(client, drainRingLines),
      loadShippedCastingSetsByQuoteLineId(
        client,
        castingAssemblyLines.map((line) => ({
          id: line.id,
          productId: line.productId,
        })),
        lineageMap,
        excludeTicketId,
      ),
    ]);

  const uniqueAssemblyProductIds = [
    ...new Set(
      castingAssemblyLines
        .map((line) => line.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const optionsByProductId = new Map<string, CastingComponentOption[]>();
  await Promise.all(
    uniqueAssemblyProductIds.map(async (productId) => {
      const options = await loadCastingComponentOptionsForAssembly(client, productId);
      optionsByProductId.set(productId, options);
    }),
  );
  const castingOptionsByLineId = new Map<string, CastingComponentOption[]>();
  for (const line of castingAssemblyLines) {
    if (line.productId) {
      castingOptionsByLineId.set(line.id, optionsByProductId.get(line.productId) ?? []);
    }
  }

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
        isCastingAssembly: false,
        castingComponentOptions: [],
      });
      continue;
    }

    if (isQuoteLineCastingAssembly(line)) {
      const castingComponentOptions =
        castingOptionsByLineId.get(line.id) ?? [];
      const quotedQty = Number(line.quantity);
      const shippedQty = shippedCastingSets.get(line.id) ?? 0;
      const remainingQty = Math.max(0, quotedQty - shippedQty);

      let eligible = remainingQty > 0;
      let eligibilityReason: string | null = null;
      if (remainingQty <= 0) {
        eligible = false;
        eligibilityReason = "Fully shipped";
      } else if (castingComponentOptions.length === 0) {
        eligible = false;
        eligibilityReason = "No BOM components linked to this casting";
      } else {
        const hasStock = castingComponentOptions.some(
          (option) =>
            !option.trackInventory ||
            (option.currentStock != null && option.currentStock > 0),
        );
        if (!hasStock) {
          eligible = true;
          eligibilityReason = "No casting pieces in stock";
        }
      }

      result.push({
        quoteLineItemId: line.id,
        lineNumber: line.lineNumber,
        lineType: line.lineType,
        itemCode: line.itemCode,
        description: line.description,
        displayName: resolveDisplayName(line),
        unit: line.unit || "EA",
        weightEach: resolveWeightEach(line),
        quotedQty,
        shippedQty,
        remainingQty,
        eligible,
        eligibilityReason,
        jobStructureId: line.jobStructureId,
        jobStructureStatus: null,
        productId: line.productId,
        currentStock: null,
        isDrainRing: false,
        ringDiameterFeet: null,
        poolHeightFeet: null,
        drainRingStyle: "DRAIN",
        drainRingOptions: [],
        isCastingAssembly: true,
        castingComponentOptions,
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
      isCastingAssembly: false,
      castingComponentOptions: [],
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

  // Fast path: skip opening a transaction when already delivered. The
  // authoritative guard is the conditional update inside the transaction below.
  if (ticket.status === "DELIVERED") {
    return;
  }

  const deliveredAt = new Date();

  await client.$transaction(async (tx) => {
    // Atomic compare-and-set: only one concurrent caller can flip the ticket
    // out of its non-DELIVERED state. The losing transaction sees count === 0
    // (after the winner commits) and stops, so stock is never deducted twice.
    const claimed = await tx.deliveryTicket.updateMany({
      where: { id: deliveryTicketId, status: { not: "DELIVERED" } },
      data: {
        status: "DELIVERED",
        deliveredAt,
        signedBy: options?.signedBy ?? ticket.signedBy,
      },
    });

    if (claimed.count === 0) {
      return;
    }

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
