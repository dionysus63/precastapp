import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getDefaultPriceListId } from "@/lib/price-list-service";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Per-price-list structure pricing with default-list fallback: a quote's
 * list wins; anything it does not price falls back to the default list's
 * entry (flagged so UIs can warn); no entry anywhere = unpriced.
 */

export type DiameterPricing = {
  wallPricePerFoot: number;
  basePrice: number;
  usedFallback: boolean;
};

export type RectTemplatePricing = {
  wallPricePerFoot: number;
  topSlabPrice: number;
  baseSlabPrice: number;
  usedFallback: boolean;
};

export type OpeningPricing = {
  price: number;
  usedFallback: boolean;
};

export type StructurePricing = {
  /** The list actually requested (null = pricing straight off the default). */
  requestedPriceListId: string | null;
  defaultPriceListId: string | null;
  diameters: Map<string, DiameterPricing>;
  rectTemplates: Map<string, RectTemplatePricing>;
  pipeOpenings: Map<string, OpeningPricing>;
  rectOpenings: Map<string, OpeningPricing>;
};

/**
 * Merge target-list rows over default-list rows. Pure so the fallback rule
 * is unit-testable: target wins; default fills gaps with usedFallback: true
 * (only flagged when a distinct target list was requested).
 */
export function mergePriceEntries<Row, Value>(
  targetRows: Row[],
  defaultRows: Row[],
  keyOf: (row: Row) => string,
  valueOf: (row: Row, usedFallback: boolean) => Value,
  targetIsDefault: boolean,
): Map<string, Value> {
  const merged = new Map<string, Value>();
  for (const row of defaultRows) {
    merged.set(keyOf(row), valueOf(row, !targetIsDefault));
  }
  for (const row of targetRows) {
    merged.set(keyOf(row), valueOf(row, false));
  }
  return merged;
}

export async function loadStructurePricing(
  priceListId: string | null,
  client: DbClient = prisma,
): Promise<StructurePricing> {
  const defaultPriceListId = await getDefaultPriceListId(client);
  const targetId = priceListId ?? defaultPriceListId;
  const listIds = [
    ...new Set([targetId, defaultPriceListId].filter((id): id is string => !!id)),
  ];
  const targetIsDefault = targetId === defaultPriceListId;

  if (listIds.length === 0) {
    return {
      requestedPriceListId: priceListId,
      defaultPriceListId,
      diameters: new Map(),
      rectTemplates: new Map(),
      pipeOpenings: new Map(),
      rectOpenings: new Map(),
    };
  }

  // Sequential: `client` may be a transaction client pinned to one connection.
  const diameterRows = await client.diameterPriceListEntry.findMany({
    where: { priceListId: { in: listIds } },
  });
  const rectTemplateRows = await client.rectTemplatePriceListEntry.findMany({
    where: { priceListId: { in: listIds } },
  });
  const pipeOpeningRows = await client.pipeOpeningPriceListEntry.findMany({
    where: { priceListId: { in: listIds } },
  });
  const rectOpeningRows = await client.rectOpeningPriceListEntry.findMany({
    where: { priceListId: { in: listIds } },
  });

  const split = <Row extends { priceListId: string }>(rows: Row[]) => ({
    target: rows.filter((row) => row.priceListId === targetId),
    fallback: targetIsDefault
      ? []
      : rows.filter((row) => row.priceListId === defaultPriceListId),
  });

  const diameterSplit = split(diameterRows);
  const rectTemplateSplit = split(rectTemplateRows);
  const pipeOpeningSplit = split(pipeOpeningRows);
  const rectOpeningSplit = split(rectOpeningRows);

  return {
    requestedPriceListId: priceListId,
    defaultPriceListId,
    diameters: mergePriceEntries(
      diameterSplit.target,
      diameterSplit.fallback,
      (row) => row.diameterConfigId,
      (row, usedFallback) => ({
        wallPricePerFoot: Number(row.wallPricePerFoot),
        basePrice: Number(row.basePrice),
        usedFallback,
      }),
      targetIsDefault,
    ),
    rectTemplates: mergePriceEntries(
      rectTemplateSplit.target,
      rectTemplateSplit.fallback,
      (row) => row.templateId,
      (row, usedFallback) => ({
        wallPricePerFoot: Number(row.wallPricePerFoot),
        topSlabPrice: Number(row.topSlabPrice),
        baseSlabPrice: Number(row.baseSlabPrice),
        usedFallback,
      }),
      targetIsDefault,
    ),
    pipeOpenings: mergePriceEntries(
      pipeOpeningSplit.target,
      pipeOpeningSplit.fallback,
      (row) => row.pipeOpeningSizeId,
      (row, usedFallback) => ({
        price: Number(row.pricePerBoot),
        usedFallback,
      }),
      targetIsDefault,
    ),
    rectOpenings: mergePriceEntries(
      rectOpeningSplit.target,
      rectOpeningSplit.fallback,
      (row) => row.rectOpeningSizeId,
      (row, usedFallback) => ({
        price: Number(row.pricePerOpening),
        usedFallback,
      }),
      targetIsDefault,
    ),
  };
}

export type StructurePricingCompleteness = {
  molds: { total: number; priced: number };
  rectTemplates: { total: number; priced: number };
  pipeOpenings: { total: number; priced: number };
  rectOpenings: { total: number; priced: number };
};

/**
 * How much of the structure-pricing surface a list covers. Opening prices
 * are optional per row, so their counts are informational; molds and active
 * rect templates should be fully priced on the default list.
 */
export async function getStructurePricingCompleteness(
  priceListId: string,
  client: DbClient = prisma,
): Promise<StructurePricingCompleteness> {
  // Sequential: `client` may be a transaction client pinned to one connection.
  const moldTotal = await client.structureDiameterConfig.count();
  const moldPriced = await client.diameterPriceListEntry.count({
    where: { priceListId },
  });
  const rectTemplateTotal = await client.structureTemplate.count({
    where: { shape: "RECTANGULAR", status: "ACTIVE" },
  });
  const rectTemplatePriced = await client.rectTemplatePriceListEntry.count({
    where: { priceListId, template: { status: "ACTIVE" } },
  });
  const pipeOpeningTotal = await client.pipeOpeningSize.count();
  const pipeOpeningPriced = await client.pipeOpeningPriceListEntry.count({
    where: { priceListId },
  });
  const rectOpeningTotal = await client.rectOpeningSize.count();
  const rectOpeningPriced = await client.rectOpeningPriceListEntry.count({
    where: { priceListId },
  });

  return {
    molds: { total: moldTotal, priced: moldPriced },
    rectTemplates: { total: rectTemplateTotal, priced: rectTemplatePriced },
    pipeOpenings: { total: pipeOpeningTotal, priced: pipeOpeningPriced },
    rectOpenings: { total: rectOpeningTotal, priced: rectOpeningPriced },
  };
}

/**
 * The default list is the fallback for every other list, so its mold and
 * rect-template prices must be complete (openings may legitimately be
 * unpriced per row).
 */
export async function assertStructurePricingCompleteForDefault(
  priceListId: string,
  client: DbClient = prisma,
): Promise<void> {
  const completeness = await getStructurePricingCompleteness(
    priceListId,
    client,
  );
  const problems: string[] = [];
  if (completeness.molds.priced < completeness.molds.total) {
    problems.push(
      `${completeness.molds.total - completeness.molds.priced} mold(s) missing wall/base prices`,
    );
  }
  if (completeness.rectTemplates.priced < completeness.rectTemplates.total) {
    problems.push(
      `${completeness.rectTemplates.total - completeness.rectTemplates.priced} rectangular template(s) missing prices`,
    );
  }
  if (problems.length > 0) {
    throw new Error(`Cannot set as default: ${problems.join("; ")}.`);
  }
}

/**
 * Copies every structure price entry from one list to another. The target is
 * normally a brand-new list, so entries are bulk-inserted; any the target
 * already has are updated in place.
 */
export async function copyStructurePriceEntries(
  targetPriceListId: string,
  sourcePriceListId: string,
  client: DbClient = prisma,
): Promise<void> {
  const diameterRows = await client.diameterPriceListEntry.findMany({
    where: { priceListId: sourcePriceListId },
    select: { diameterConfigId: true, wallPricePerFoot: true, basePrice: true },
  });
  const existingDiameters = new Set(
    (
      await client.diameterPriceListEntry.findMany({
        where: { priceListId: targetPriceListId },
        select: { diameterConfigId: true },
      })
    ).map((row) => row.diameterConfigId),
  );
  await client.diameterPriceListEntry.createMany({
    data: diameterRows
      .filter((row) => !existingDiameters.has(row.diameterConfigId))
      .map((row) => ({ priceListId: targetPriceListId, ...row })),
  });
  for (const { diameterConfigId, ...prices } of diameterRows.filter((row) =>
    existingDiameters.has(row.diameterConfigId),
  )) {
    await client.diameterPriceListEntry.update({
      where: {
        priceListId_diameterConfigId: {
          priceListId: targetPriceListId,
          diameterConfigId,
        },
      },
      data: prices,
    });
  }

  const rectTemplateRows = await client.rectTemplatePriceListEntry.findMany({
    where: { priceListId: sourcePriceListId },
    select: {
      templateId: true,
      wallPricePerFoot: true,
      topSlabPrice: true,
      baseSlabPrice: true,
    },
  });
  const existingTemplates = new Set(
    (
      await client.rectTemplatePriceListEntry.findMany({
        where: { priceListId: targetPriceListId },
        select: { templateId: true },
      })
    ).map((row) => row.templateId),
  );
  await client.rectTemplatePriceListEntry.createMany({
    data: rectTemplateRows
      .filter((row) => !existingTemplates.has(row.templateId))
      .map((row) => ({ priceListId: targetPriceListId, ...row })),
  });
  for (const { templateId, ...prices } of rectTemplateRows.filter((row) =>
    existingTemplates.has(row.templateId),
  )) {
    await client.rectTemplatePriceListEntry.update({
      where: {
        priceListId_templateId: { priceListId: targetPriceListId, templateId },
      },
      data: prices,
    });
  }

  const pipeOpeningRows = await client.pipeOpeningPriceListEntry.findMany({
    where: { priceListId: sourcePriceListId },
    select: { pipeOpeningSizeId: true, pricePerBoot: true },
  });
  const existingPipeOpenings = new Set(
    (
      await client.pipeOpeningPriceListEntry.findMany({
        where: { priceListId: targetPriceListId },
        select: { pipeOpeningSizeId: true },
      })
    ).map((row) => row.pipeOpeningSizeId),
  );
  await client.pipeOpeningPriceListEntry.createMany({
    data: pipeOpeningRows
      .filter((row) => !existingPipeOpenings.has(row.pipeOpeningSizeId))
      .map((row) => ({ priceListId: targetPriceListId, ...row })),
  });
  for (const { pipeOpeningSizeId, pricePerBoot } of pipeOpeningRows.filter(
    (row) => existingPipeOpenings.has(row.pipeOpeningSizeId),
  )) {
    await client.pipeOpeningPriceListEntry.update({
      where: {
        priceListId_pipeOpeningSizeId: {
          priceListId: targetPriceListId,
          pipeOpeningSizeId,
        },
      },
      data: { pricePerBoot },
    });
  }

  const rectOpeningRows = await client.rectOpeningPriceListEntry.findMany({
    where: { priceListId: sourcePriceListId },
    select: { rectOpeningSizeId: true, pricePerOpening: true },
  });
  const existingRectOpenings = new Set(
    (
      await client.rectOpeningPriceListEntry.findMany({
        where: { priceListId: targetPriceListId },
        select: { rectOpeningSizeId: true },
      })
    ).map((row) => row.rectOpeningSizeId),
  );
  await client.rectOpeningPriceListEntry.createMany({
    data: rectOpeningRows
      .filter((row) => !existingRectOpenings.has(row.rectOpeningSizeId))
      .map((row) => ({ priceListId: targetPriceListId, ...row })),
  });
  for (const { rectOpeningSizeId, pricePerOpening } of rectOpeningRows.filter(
    (row) => existingRectOpenings.has(row.rectOpeningSizeId),
  )) {
    await client.rectOpeningPriceListEntry.update({
      where: {
        priceListId_rectOpeningSizeId: {
          priceListId: targetPriceListId,
          rectOpeningSizeId,
        },
      },
      data: { pricePerOpening },
    });
  }
}

/**
 * The price list a structure should price against: its quote's list, else
 * the default. Standalone sheets (no quote) price off the default list.
 */
export async function getPriceListIdForStructure(
  jobStructureId: string,
  client: DbClient = prisma,
): Promise<string | null> {
  const structure = await client.jobStructure.findUnique({
    where: { id: jobStructureId },
    select: { quote: { select: { priceListId: true } } },
  });
  return structure?.quote?.priceListId ?? null;
}
