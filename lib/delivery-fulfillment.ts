import type { PrismaClient } from "@/app/generated/prisma/client";
import type {
  DeliveryTicketStatus,
  QuoteLineType,
} from "@/app/generated/prisma/client";
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
  type CastingComponentOption,
  type CastingPieceRole,
} from "@/lib/casting-utils";
import {
  resolveEffectiveAssemblyWeight,
  loadCastingComponentOptionsByAssembly,
  loadDerivedAssemblyValues,
} from "@/lib/casting-service";
import { promoteJobStatus } from "@/lib/job-status-workflow";
import { richTextToPlainText } from "@/lib/rich-text";
import {
  formatAdsPipeJointTypeLabel,
  normalizeAdsPipeJointType,
  type AdsPipeJointType,
} from "@/lib/ads-pipe-utils";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const DELIVERED_TICKET_STATUS: DeliveryTicketStatus = "DELIVERED";

export const SCHEDULED_TICKET_STATUSES: DeliveryTicketStatus[] = [
  "SCHEDULED",
  "LOADING",
  "IN_TRANSIT",
];

/** Every non-terminal status. Used when validating new tickets so DRAFT
 * quantities count as committed (status promotion never re-validates lines). */
export const OPEN_TICKET_STATUSES: DeliveryTicketStatus[] = [
  "DRAFT",
  ...SCHEDULED_TICKET_STATUSES,
];

/**
 * Tickets whose quantities should be ignored during aggregation — a single
 * ticket while editing it, or the whole set of planner-managed drafts while
 * re-planning them (their quantities live in the grid instead).
 */
type ExcludeTickets = string | string[] | undefined;

function excludedTicketWhere(exclude: ExcludeTickets) {
  if (!exclude || (Array.isArray(exclude) && exclude.length === 0)) {
    return {};
  }
  return Array.isArray(exclude)
    ? { id: { notIn: exclude } }
    : { id: { not: exclude } };
}

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

export type AdsPipeOption = {
  productId: string;
  productCode: string;
  name: string;
  jointType: AdsPipeJointType;
  jointTypeLabel: string;
  currentStock: number | null;
  weightEach: number | null;
  isSubstitute: boolean;
};

export type StructurePieceOption = {
  pieceId: string;
  name: string;
  weightLbs: number | null;
  deliveredTicketNumber: string | null;
  openTicketNumber: string | null;
};

/**
 * Structure statuses dispatch may plan loads against. Earlier statuses
 * (Not Submitted / Submitted) aren't cleared for production yet; ticket
 * saves enforce the same set server-side.
 */
export const PLANNABLE_STRUCTURE_STATUSES = [
  "APPROVED",
  "IN_PRODUCTION",
  "MADE",
];

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
  /**
   * Cumulative made count from the Daily Production log for structure
   * quantity lines (null for other line kinds). Dispatch plans ahead freely;
   * this is the "how much physically exists" signal shown alongside.
   */
  madeSoFarQty: number | null;
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
  isAdsPipe: boolean;
  adsPipeOptions: AdsPipeOption[];
  isSplitStructure: boolean;
  structurePieceOptions: StructurePieceOption[];
};

/**
 * Quote line (and legacy structure) descriptions are rich text — HTML-escaped
 * with entities like `&quot;` and `<br>` markup. Delivery surfaces are plain
 * text, so decode before anything displays or stores these.
 */
function toPlainDescription(description: string | null): string | null {
  if (!description?.trim()) {
    return null;
  }
  return richTextToPlainText(description) || null;
}

/** Single-line variant for grid labels. */
function toPlainLabel(description: string | null): string | null {
  return toPlainDescription(description)?.replace(/\s+/g, " ").trim() || null;
}

function resolveDisplayName(line: {
  itemCode: string;
  description: string | null;
  product: { name: string } | null;
  jobStructure: { description: string | null; structureNumber: string | null } | null;
}): string {
  if (line.product?.name) {
    return line.product.name;
  }
  const structureDescription = toPlainLabel(
    line.jobStructure?.description ?? null,
  );
  if (structureDescription) {
    return structureDescription;
  }
  if (line.jobStructure?.structureNumber?.trim()) {
    return line.jobStructure.structureNumber.trim();
  }
  const lineDescription = toPlainLabel(line.description);
  if (lineDescription) {
    return lineDescription;
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

/**
 * Every line id in the quote's revision lineage (ancestors included) mapped
 * to the quote's CURRENT line id. Delivery tickets created before a quote
 * revision still reference superseded line ids; callers resolve those
 * references to the live lines through this map.
 */
export async function buildQuoteLineAliasMap(
  client: DbClient,
  quoteId: string,
): Promise<Map<string, string>> {
  const lines = await client.quoteLineItem.findMany({
    where: { quoteId },
    select: { id: true },
  });
  const lineageMap = await buildQuoteLineLineageMap(
    client,
    lines.map((line) => line.id),
  );

  const alias = new Map<string, string>();
  for (const [currentId, chain] of lineageMap) {
    for (const id of chain) {
      alias.set(id, currentId);
    }
  }
  return alias;
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
  excludeTicketId?: string | string[],
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
  excludeTicketId?: string | string[],
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
  excludeTicketId?: string | string[],
  ticketStatuses: readonly DeliveryTicketStatus[] = [DELIVERED_TICKET_STATUS],
): Promise<Map<string, Prisma.Decimal>> {
  const quoteLineItemIds = allLineageIds(lineageMap);
  if (quoteLineItemIds.length === 0) {
    return new Map();
  }

  const grouped = await client.deliveryTicketLineItem.groupBy({
    by: ["quoteLineItemId"],
    where: {
      quoteLineItemId: { in: quoteLineItemIds },
      deliveryTicket: {
        status: { in: [...ticketStatuses] },
        ...excludedTicketWhere(excludeTicketId),
      },
    },
    _sum: { quantity: true },
  });

  const rawTotals = new Map<string, Prisma.Decimal>();
  for (const row of grouped) {
    if (!row.quoteLineItemId) {
      continue;
    }
    rawTotals.set(
      row.quoteLineItemId,
      row._sum.quantity ?? new Prisma.Decimal(0),
    );
  }

  return rollUpDecimalTotals(lineageMap, rawTotals);
}

async function loadShippedFeetByQuoteLineId(
  client: DbClient,
  lineageMap: Map<string, string[]>,
  excludeTicketId?: string | string[],
  ticketStatuses: readonly DeliveryTicketStatus[] = [DELIVERED_TICKET_STATUS],
): Promise<Map<string, number>> {
  const quoteLineItemIds = allLineageIds(lineageMap);
  if (quoteLineItemIds.length === 0) {
    return new Map();
  }

  // groupBy cannot join product, so group per (line, product) and fetch
  // the distinct product heights in a second query.
  const grouped = await client.deliveryTicketLineItem.groupBy({
    by: ["quoteLineItemId", "productId"],
    where: {
      quoteLineItemId: { in: quoteLineItemIds },
      deliveryTicket: {
        status: { in: [...ticketStatuses] },
        ...excludedTicketWhere(excludeTicketId),
      },
    },
    _sum: { quantity: true },
  });

  const productIds = [
    ...new Set(
      grouped
        .map((row) => row.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const products =
    productIds.length > 0
      ? await client.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, heightFeet: true },
        })
      : [];
  const heightByProductId = new Map(
    products.map((product) => [product.id, product.heightFeet]),
  );

  const rawTotals = new Map<string, number>();
  for (const row of grouped) {
    if (!row.quoteLineItemId) {
      continue;
    }
    const rawHeight = row.productId
      ? heightByProductId.get(row.productId)
      : null;
    const heightFeet = rawHeight != null ? Number(rawHeight) : 0;
    const quantity = row._sum.quantity ?? new Prisma.Decimal(0);
    const current = rawTotals.get(row.quoteLineItemId) ?? 0;
    rawTotals.set(
      row.quoteLineItemId,
      current + heightFeet * Number(quantity),
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
  product?: { castingRole?: string | null; castingSoldAsUnit?: boolean } | null;
}): boolean {
  return (
    line.product?.castingRole === "ASSEMBLY" &&
    !line.product?.castingSoldAsUnit
  );
}

async function loadShippedCastingSetsByQuoteLineId(
  client: DbClient,
  castingLines: Array<{
    id: string;
    productId: string | null;
  }>,
  lineageMap: Map<string, string[]>,
  excludeTicketId?: string | string[],
  ticketStatuses: readonly DeliveryTicketStatus[] = [DELIVERED_TICKET_STATUS],
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

  // Sequential awaits: `client` may be a transaction client, which is pinned
  // to a single pg connection — concurrent queries on it are unsupported
  // (deprecated in pg 8, removed in pg 9).
  const deliveryLines = await client.deliveryTicketLineItem.groupBy({
    by: ["quoteLineItemId", "productId"],
    where: {
      quoteLineItemId: { in: lineIds },
      deliveryTicket: {
        status: { in: [...ticketStatuses] },
        ...excludedTicketWhere(excludeTicketId),
      },
    },
    _sum: { quantity: true },
  });
  const bomRows = await client.productCastingComponent.findMany({
    where: { assemblyId: { in: assemblyIds } },
    select: {
      assemblyId: true,
      componentId: true,
      pieceRole: true,
      quantity: true,
    },
  });

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
          Number(entry._sum.quantity ?? new Prisma.Decimal(0)),
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

function needsAdsPipeSubstitute(
  line: {
    lineType: QuoteLineType;
    product: {
      productType: string;
      pipeJointType: string | null;
      trackInventory: boolean;
      currentStockQuantity: number;
    } | null;
  },
  remainingQty: number,
): boolean {
  if (line.lineType !== "STOCK_PRODUCT" || !line.product) {
    return false;
  }
  if (line.product.productType !== "ADS_PIPE") {
    return false;
  }
  if (normalizeAdsPipeJointType(line.product.pipeJointType) !== "ST") {
    return false;
  }
  if (!line.product.trackInventory) {
    return false;
  }
  return line.product.currentStockQuantity < remainingQty;
}

async function loadAdsPipeCatalogByLine(
  client: DbClient,
  adsPipeLines: Array<{
    product: {
      id: string;
      pipeDiameterInches: Prisma.Decimal | null;
      pipeLengthFeet: Prisma.Decimal | null;
      pipeJointType: string | null;
    } | null;
  }>,
): Promise<Map<string, AdsPipeOption[]>> {
  const combos = new Map<
    string,
    {
      pipeDiameterInches: Prisma.Decimal;
      pipeLengthFeet: Prisma.Decimal;
      quotedProductId: string;
      quotedJointType: AdsPipeJointType;
    }
  >();

  for (const line of adsPipeLines) {
    const product = line.product;
    if (
      !product?.pipeDiameterInches ||
      !product.pipeLengthFeet ||
      !product.pipeJointType
    ) {
      continue;
    }
    const quotedJointType = normalizeAdsPipeJointType(product.pipeJointType);
    if (!quotedJointType) {
      continue;
    }
    combos.set(product.id, {
      pipeDiameterInches: product.pipeDiameterInches,
      pipeLengthFeet: product.pipeLengthFeet,
      quotedProductId: product.id,
      quotedJointType,
    });
  }

  if (combos.size === 0) {
    return new Map();
  }

  const pipeProducts = await client.product.findMany({
    where: {
      productType: "ADS_PIPE",
      status: "ACTIVE",
      OR: [...combos.values()].map((combo) => ({
        pipeDiameterInches: combo.pipeDiameterInches,
        pipeLengthFeet: combo.pipeLengthFeet,
      })),
    },
    orderBy: [{ pipeJointType: "asc" }, { productCode: "asc" }],
    select: {
      id: true,
      productCode: true,
      name: true,
      pipeJointType: true,
      pipeDiameterInches: true,
      pipeLengthFeet: true,
      weight: true,
      currentStockQuantity: true,
      trackInventory: true,
    },
  });

  const catalog = new Map<string, AdsPipeOption[]>();

  for (const [quotedProductId, combo] of combos) {
    const options: AdsPipeOption[] = [];
    for (const product of pipeProducts) {
      if (
        product.pipeDiameterInches == null ||
        product.pipeLengthFeet == null
      ) {
        continue;
      }
      if (
        product.pipeDiameterInches.toString() !==
          combo.pipeDiameterInches.toString() ||
        product.pipeLengthFeet.toString() !== combo.pipeLengthFeet.toString()
      ) {
        continue;
      }
      const jointType = normalizeAdsPipeJointType(product.pipeJointType);
      if (!jointType) {
        continue;
      }
      options.push({
        productId: product.id,
        productCode: product.productCode,
        name: product.name,
        jointType,
        jointTypeLabel: formatAdsPipeJointTypeLabel(jointType),
        weightEach: product.weight != null ? Number(product.weight) : null,
        currentStock: product.trackInventory
          ? product.currentStockQuantity
          : null,
        isSubstitute:
          combo.quotedJointType === "ST" &&
          jointType === "WT" &&
          product.id !== quotedProductId,
      });
    }
    catalog.set(quotedProductId, options);
  }

  return catalog;
}

/**
 * Shared preamble for fulfillment/scheduled aggregation: fetches the quote
 * with full line-item includes, builds the lineage map, and categorizes lines
 * (drain ring / casting assembly / standard) exactly once.
 */
async function loadQuoteFulfillmentContext(client: DbClient, quoteId: string) {
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
              productType: true,
              pipeDiameterInches: true,
              pipeLengthFeet: true,
              pipeJointType: true,
              castingRole: true,
              castingSoldAsUnit: true,
              manufacturerCode: true,
            },
          },
          jobStructure: {
            select: {
              id: true,
              status: true,
              description: true,
              structureNumber: true,
              weight: true,
              pieces: {
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true,
                  name: true,
                  weightLbs: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!quote) {
    return null;
  }

  const lineIds = quote.lineItems.map((line) => line.id);
  const lineageMap = await buildQuoteLineLineageMap(client, lineIds);
  const drainRingLines = quote.lineItems.filter((line) => isQuoteLineDrainRing(line));
  const castingAssemblyLines = quote.lineItems.filter((line) =>
    isQuoteLineCastingAssembly(line),
  );
  // Structure lines whose structure has been split into named shipping
  // pieces. Tracked per piece, so they are excluded from the standard
  // quantity aggregation (their qty-1 piece lines would inflate it).
  const splitStructureLines = quote.lineItems.filter(
    (line) =>
      (line.lineType === "CONFIGURABLE_STRUCTURE" ||
        line.lineType === "CUSTOM_STRUCTURE") &&
      (line.jobStructure?.pieces.length ?? 0) > 0,
  );
  const splitStructureLineIds = new Set(splitStructureLines.map((line) => line.id));
  const adsPipeSubstituteLines = quote.lineItems.filter((line) => {
    if (isQuoteLineDrainRing(line) || isQuoteLineCastingAssembly(line)) {
      return false;
    }
    const remainingQty = Number(line.quantity);
    return needsAdsPipeSubstitute(line, remainingQty);
  });
  const standardLineIds = quote.lineItems
    .filter(
      (line) =>
        !isQuoteLineDrainRing(line) &&
        !isQuoteLineCastingAssembly(line) &&
        !splitStructureLineIds.has(line.id) &&
        !adsPipeSubstituteLines.some((candidate) => candidate.id === line.id),
    )
    .map((line) => line.id);

  const standardLineage = new Map<string, string[]>();
  for (const id of standardLineIds) {
    const chain = lineageMap.get(id);
    if (chain) {
      standardLineage.set(id, chain);
    }
  }

  return {
    quote,
    lineageMap,
    drainRingLines,
    castingAssemblyLines,
    adsPipeSubstituteLines,
    splitStructureLineIds,
    standardLineage,
  };
}

type QuoteFulfillmentContext = NonNullable<
  Awaited<ReturnType<typeof loadQuoteFulfillmentContext>>
>;

type PieceUsage = {
  deliveredTicketNumber: string | null;
  openTicketNumber: string | null;
};

/**
 * Which delivery ticket (open or delivered) currently claims each structure
 * piece. A piece lives on at most one ticket; delivered wins for display.
 */
async function loadStructurePieceUsage(
  client: DbClient,
  pieceIds: string[],
  exclude: ExcludeTickets,
): Promise<Map<string, PieceUsage>> {
  if (pieceIds.length === 0) {
    return new Map();
  }
  const lines = await client.deliveryTicketLineItem.findMany({
    where: {
      jobStructurePieceId: { in: pieceIds },
      deliveryTicket: {
        status: { in: [...OPEN_TICKET_STATUSES, DELIVERED_TICKET_STATUS] },
        ...excludedTicketWhere(exclude),
      },
    },
    select: {
      jobStructurePieceId: true,
      deliveryTicket: { select: { ticketNumber: true, status: true } },
    },
  });

  const usage = new Map<string, PieceUsage>();
  for (const line of lines) {
    if (!line.jobStructurePieceId) continue;
    const entry = usage.get(line.jobStructurePieceId) ?? {
      deliveredTicketNumber: null,
      openTicketNumber: null,
    };
    if (line.deliveryTicket.status === DELIVERED_TICKET_STATUS) {
      entry.deliveredTicketNumber = line.deliveryTicket.ticketNumber;
    } else {
      entry.openTicketNumber = line.deliveryTicket.ticketNumber;
    }
    usage.set(line.jobStructurePieceId, entry);
  }
  return usage;
}

export async function getQuoteLineFulfillment(
  client: DbClient,
  quoteId: string,
  excludeTicketId?: string | string[],
): Promise<QuoteLineFulfillment[]> {
  const context = await loadQuoteFulfillmentContext(client, quoteId);
  if (!context) {
    return [];
  }
  return buildFulfillmentFromContext(client, context, excludeTicketId);
}

async function buildFulfillmentFromContext(
  client: DbClient,
  context: QuoteFulfillmentContext,
  excludeTicketId?: string | string[],
): Promise<QuoteLineFulfillment[]> {
  const {
    quote,
    lineageMap,
    drainRingLines,
    castingAssemblyLines,
    adsPipeSubstituteLines,
    splitStructureLineIds,
    standardLineage,
  } = context;

  const allSplitPieceIds = quote.lineItems
    .filter((line) => splitStructureLineIds.has(line.id))
    .flatMap((line) => line.jobStructure?.pieces.map((piece) => piece.id) ?? []);
  const pieceUsage = await loadStructurePieceUsage(
    client,
    allSplitPieceIds,
    excludeTicketId,
  );

  // Sequential awaits: `client` may be a transaction client (single pinned
  // connection; no concurrent queries — see loadCastingSetUsage).
  const shippedQuantities = await loadShippedQuantitiesByQuoteLineId(
    client,
    standardLineage,
    excludeTicketId,
  );
  const shippedFeet = await loadShippedFeetByQuoteLineId(
    client,
    lineageMap,
    excludeTicketId,
  );
  const drainRingCatalog = await loadDrainRingCatalogByLine(
    client,
    drainRingLines,
  );
  const shippedCastingSets = await loadShippedCastingSetsByQuoteLineId(
    client,
    castingAssemblyLines.map((line) => ({
      id: line.id,
      productId: line.productId,
    })),
    lineageMap,
    excludeTicketId,
  );
  const adsPipeCatalog = await loadAdsPipeCatalogByLine(
    client,
    adsPipeSubstituteLines,
  );

  const uniqueAssemblyProductIds = [
    ...new Set(
      castingAssemblyLines
        .map((line) => line.productId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  // Single batched query instead of one query per assembly.
  const optionsByProductId = await loadCastingComponentOptionsByAssembly(
    client,
    uniqueAssemblyProductIds,
  );
  const derivedAssemblyValues = await loadDerivedAssemblyValues(
    client,
    uniqueAssemblyProductIds,
  );
  const castingOptionsByLineId = new Map<string, CastingComponentOption[]>();
  for (const line of castingAssemblyLines) {
    if (line.productId) {
      castingOptionsByLineId.set(line.id, optionsByProductId.get(line.productId) ?? []);
    }
  }

  // Daily Production made counts for non-split structure quantity lines —
  // dispatch plans ahead freely, but sees how much physically exists.
  const structureIdsForMadeCounts = [
    ...new Set(
      quote.lineItems
        .filter(
          (line) =>
            (line.lineType === "CONFIGURABLE_STRUCTURE" ||
              line.lineType === "CUSTOM_STRUCTURE") &&
            line.jobStructureId &&
            !splitStructureLineIds.has(line.id),
        )
        .map((line) => line.jobStructureId!),
    ),
  ];
  const madeSums =
    structureIdsForMadeCounts.length > 0
      ? await client.dailyProductionStructureLine.groupBy({
          by: ["jobStructureId"],
          where: { jobStructureId: { in: structureIdsForMadeCounts } },
          _sum: { quantityMade: true },
        })
      : [];
  const madeSoFarByStructure = new Map(
    madeSums.map((row) => [
      row.jobStructureId,
      Number(row._sum.quantityMade ?? 0),
    ]),
  );

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
        description: toPlainDescription(line.description),
        displayName: resolveDisplayName(line),
        unit: line.unit || "LF",
        weightEach: resolveWeightEach(line),
        quotedQty,
        shippedQty,
        remainingQty,
        eligible,
        eligibilityReason,
        madeSoFarQty: null,
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
        isAdsPipe: false,
        adsPipeOptions: [],
        isSplitStructure: false,
        structurePieceOptions: [],
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

      const derived = line.productId
        ? derivedAssemblyValues.get(line.productId)
        : undefined;
      // Line/product weight wins; a parts-mode assembly whose weight is blank
      // or 0 falls back to the combined parts weight.
      const assemblyWeight =
        resolveWeightEach(line) ||
        (line.product
          ? resolveEffectiveAssemblyWeight(line.product, derived)
          : null);

      result.push({
        quoteLineItemId: line.id,
        lineNumber: line.lineNumber,
        lineType: line.lineType,
        itemCode: line.itemCode,
        description: toPlainDescription(line.description),
        displayName: resolveDisplayName(line),
        unit: line.unit || "EA",
        weightEach: assemblyWeight,
        quotedQty,
        shippedQty,
        remainingQty,
        eligible,
        eligibilityReason,
        madeSoFarQty: null,
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
        isAdsPipe: false,
        adsPipeOptions: [],
        isSplitStructure: false,
        structurePieceOptions: [],
      });
      continue;
    }

    if (splitStructureLineIds.has(line.id) && line.jobStructure) {
      const structurePieceOptions: StructurePieceOption[] =
        line.jobStructure.pieces.map((piece) => {
          const usage = pieceUsage.get(piece.id);
          return {
            pieceId: piece.id,
            name: piece.name,
            weightLbs: piece.weightLbs != null ? Number(piece.weightLbs) : null,
            deliveredTicketNumber: usage?.deliveredTicketNumber ?? null,
            openTicketNumber: usage?.openTicketNumber ?? null,
          };
        });

      const deliveredCount = structurePieceOptions.filter(
        (option) => option.deliveredTicketNumber,
      ).length;
      const claimedCount = structurePieceOptions.filter(
        (option) => option.deliveredTicketNumber || option.openTicketNumber,
      ).length;

      const quotedQty = Number(line.quantity);
      const shippedQty =
        deliveredCount === structurePieceOptions.length ? quotedQty : 0;
      const remainingQty = Math.max(0, quotedQty - shippedQty);

      let eligible = true;
      let eligibilityReason: string | null = null;
      if (remainingQty <= 0 || line.jobStructure.status === "SHIPPED") {
        eligible = false;
        eligibilityReason = "Fully shipped";
      } else if (line.jobStructure.status !== "MADE") {
        eligible = false;
        eligibilityReason = `Structure status: ${line.jobStructure.status}`;
      } else if (claimedCount === structurePieceOptions.length) {
        eligible = false;
        eligibilityReason = "All pieces are scheduled or shipped";
      }

      result.push({
        quoteLineItemId: line.id,
        lineNumber: line.lineNumber,
        lineType: line.lineType,
        itemCode: line.itemCode,
        description: toPlainDescription(line.description),
        displayName: resolveDisplayName(line),
        unit: line.unit || "EA",
        weightEach: resolveWeightEach(line),
        quotedQty,
        shippedQty,
        remainingQty,
        eligible,
        eligibilityReason,
        madeSoFarQty: null,
        jobStructureId: line.jobStructureId,
        jobStructureStatus: line.jobStructure.status,
        productId: line.productId,
        currentStock: null,
        isDrainRing: false,
        ringDiameterFeet: null,
        poolHeightFeet: null,
        drainRingStyle: "DRAIN",
        drainRingOptions: [],
        isCastingAssembly: false,
        castingComponentOptions: [],
        isAdsPipe: false,
        adsPipeOptions: [],
        isSplitStructure: true,
        structurePieceOptions,
      });
      continue;
    }

    const shipped = shippedQuantities.get(line.id) ?? new Prisma.Decimal(0);
    const quotedQty = Number(line.quantity);
    const shippedQty = Number(shipped);
    const remainingQty = Math.max(0, quotedQty - shippedQty);

    if (needsAdsPipeSubstitute(line, remainingQty)) {
      const adsPipeOptions =
        (line.productId ? adsPipeCatalog.get(line.productId) : null) ?? [];

      let eligible = remainingQty > 0;
      let eligibilityReason: string | null = null;
      if (remainingQty <= 0) {
        eligible = false;
        eligibilityReason = "Fully shipped";
      } else if (adsPipeOptions.length === 0) {
        eligible = false;
        eligibilityReason = "No matching ADS pipe SKUs in catalog";
      } else {
        const hasStock = adsPipeOptions.some(
          (option) =>
            option.currentStock == null || option.currentStock > 0,
        );
        if (!hasStock) {
          eligible = true;
          eligibilityReason = "No ADS pipe in stock";
        }
      }

      result.push({
        quoteLineItemId: line.id,
        lineNumber: line.lineNumber,
        lineType: line.lineType,
        itemCode: line.itemCode,
        description: toPlainDescription(line.description),
        displayName: resolveDisplayName(line),
        unit: line.unit,
        weightEach: resolveWeightEach(line),
        quotedQty,
        shippedQty,
        remainingQty,
        eligible,
        eligibilityReason,
        madeSoFarQty: null,
        jobStructureId: line.jobStructureId,
        jobStructureStatus: null,
        productId: line.productId,
        currentStock: line.product?.trackInventory
          ? line.product.currentStockQuantity
          : null,
        isDrainRing: false,
        ringDiameterFeet: null,
        poolHeightFeet: null,
        drainRingStyle: "DRAIN",
        drainRingOptions: [],
        isCastingAssembly: false,
        castingComponentOptions: [],
        isAdsPipe: true,
        adsPipeOptions,
        isSplitStructure: false,
        structurePieceOptions: [],
      });
      continue;
    }

    let eligible = remainingQty > 0;
    let eligibilityReason: string | null = null;
    let madeSoFarQty: number | null = null;

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
      } else if (
        !PLANNABLE_STRUCTURE_STATUSES.includes(line.jobStructure.status)
      ) {
        // Not yet cleared for production — dispatch plans ahead freely once
        // a structure is Approved, informed by the made-so-far count.
        eligible = false;
        eligibilityReason = `Structure status: ${line.jobStructure.status}`;
      } else {
        madeSoFarQty =
          line.jobStructure.status === "MADE"
            ? quotedQty
            : (madeSoFarByStructure.get(line.jobStructureId ?? "") ?? 0);
      }
    }

    result.push({
      quoteLineItemId: line.id,
      lineNumber: line.lineNumber,
      lineType: line.lineType,
      itemCode: line.itemCode,
      description: toPlainDescription(line.description),
      displayName: resolveDisplayName(line),
      unit: line.unit,
      weightEach: resolveWeightEach(line),
      quotedQty,
      shippedQty,
      remainingQty,
      eligible,
      eligibilityReason,
      madeSoFarQty,
      jobStructureId: line.jobStructureId,
      jobStructureStatus: line.jobStructure?.status ?? null,
      productId: line.productId,
      currentStock: line.product?.trackInventory
        ? line.product.currentStockQuantity
        : null,
      isDrainRing: false,
      ringDiameterFeet: null,
      poolHeightFeet: null,
      drainRingStyle: "DRAIN",
      drainRingOptions: [],
      isCastingAssembly: false,
      castingComponentOptions: [],
      isAdsPipe: false,
      adsPipeOptions: [],
      isSplitStructure: false,
      structurePieceOptions: [],
    });
  }

  return result;
}

/**
 * Scheduled (not yet delivered) quantities per quote line on open tickets.
 * Uses the same units as shipped: LF for drain rings, EA sets for castings, EA otherwise.
 */
export async function getQuoteLineScheduledQuantities(
  client: DbClient,
  quoteId: string,
  excludeTicketId?: string | string[],
  ticketStatuses: readonly DeliveryTicketStatus[] = SCHEDULED_TICKET_STATUSES,
): Promise<Map<string, number>> {
  const context = await loadQuoteFulfillmentContext(client, quoteId);
  if (!context) {
    return new Map();
  }
  return buildScheduledFromContext(client, context, excludeTicketId, ticketStatuses);
}

async function buildScheduledFromContext(
  client: DbClient,
  context: QuoteFulfillmentContext,
  excludeTicketId: string | string[] | undefined,
  ticketStatuses: readonly DeliveryTicketStatus[],
): Promise<Map<string, number>> {
  const { quote, lineageMap, castingAssemblyLines, standardLineage } = context;

  // Sequential awaits: `client` may be a transaction client (single pinned
  // connection; no concurrent queries — see loadCastingSetUsage).
  const scheduledQuantities = await loadShippedQuantitiesByQuoteLineId(
    client,
    standardLineage,
    excludeTicketId,
    ticketStatuses,
  );
  const scheduledFeet = await loadShippedFeetByQuoteLineId(
    client,
    lineageMap,
    excludeTicketId,
    ticketStatuses,
  );
  const scheduledCastingSets = await loadShippedCastingSetsByQuoteLineId(
    client,
    castingAssemblyLines.map((line) => ({
      id: line.id,
      productId: line.productId,
    })),
    lineageMap,
    excludeTicketId,
    ticketStatuses,
  );

  const result = new Map<string, number>();
  for (const line of quote.lineItems) {
    if (isQuoteLineDrainRing(line)) {
      result.set(line.id, scheduledFeet.get(line.id) ?? 0);
    } else if (isQuoteLineCastingAssembly(line)) {
      result.set(line.id, scheduledCastingSets.get(line.id) ?? 0);
    } else {
      const scheduled = scheduledQuantities.get(line.id) ?? new Prisma.Decimal(0);
      result.set(line.id, Number(scheduled));
    }
  }

  return result;
}

/**
 * Fulfillment (delivered) and scheduled quantities in one pass: runs the
 * shared quote/lineage/categorization preamble once, then both aggregation
 * sets concurrently. Prefer this when a caller needs both.
 */
export async function getQuoteLineFulfillmentAndScheduled(
  client: DbClient,
  quoteId: string,
  excludeTicketId?: string | string[],
  scheduledStatuses: readonly DeliveryTicketStatus[] = SCHEDULED_TICKET_STATUSES,
): Promise<{
  fulfillment: QuoteLineFulfillment[];
  scheduled: Map<string, number>;
}> {
  const context = await loadQuoteFulfillmentContext(client, quoteId);
  if (!context) {
    return { fulfillment: [], scheduled: new Map() };
  }

  // Sequential awaits: `client` may be a transaction client (single pinned
  // connection; no concurrent queries — see loadCastingSetUsage).
  const fulfillment = await buildFulfillmentFromContext(
    client,
    context,
    excludeTicketId,
  );
  const scheduled = await buildScheduledFromContext(
    client,
    context,
    excludeTicketId,
    scheduledStatuses,
  );

  return { fulfillment, scheduled };
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

    // Product hitting the site means the job is underway: promote earlier
    // pipeline stages to ACTIVE (never overrides ON_HOLD/COMPLETE/etc.).
    if (ticket.jobId) {
      await promoteJobStatus(tx, ticket.jobId, "DELIVERY_DELIVERED");
    }

    const wholeStructureIds = new Set<string>();
    const pieceStructureIds = new Set<string>();
    for (const line of ticket.lineItems) {
      if (
        line.jobStructureId &&
        (line.lineType === "CONFIGURABLE_STRUCTURE" ||
          line.lineType === "CUSTOM_STRUCTURE")
      ) {
        if (line.jobStructurePieceId) {
          pieceStructureIds.add(line.jobStructureId);
        } else {
          wholeStructureIds.add(line.jobStructureId);
        }
      }
    }

    for (const jobStructureId of wholeStructureIds) {
      await tx.jobStructure.update({
        where: { id: jobStructureId },
        data: { status: "SHIPPED", shippedDate: deliveredAt },
      });
    }

    // A split structure ships piecemeal: it flips to SHIPPED only when every
    // piece has a line on a delivered ticket (this ticket's claim above is
    // visible inside the transaction).
    for (const jobStructureId of pieceStructureIds) {
      const undeliveredPieces = await tx.jobStructurePiece.count({
        where: {
          jobStructureId,
          deliveryTicketLineItems: {
            none: { deliveryTicket: { status: DELIVERED_TICKET_STATUS } },
          },
        },
      });
      if (undeliveredPieces === 0) {
        await tx.jobStructure.update({
          where: { id: jobStructureId },
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
