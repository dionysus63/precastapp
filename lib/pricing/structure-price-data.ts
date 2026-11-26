import { Prisma } from "@/app/generated/prisma/client";
import { DEFAULT_APP_SETTINGS_DATA } from "@/lib/app-settings";
import { getDefaultPriceListId } from "@/lib/price-list-service";
import { prisma } from "@/lib/prisma";
import {
  STRUCTURE_PRICE_TABLE_KEYS,
  resolveStructurePriceRow,
  type StructurePriceRow,
  type StructurePriceTableKey,
  type StructurePriceTables,
} from "@/lib/pricing/structure-price-tables";
import {
  copyRingPricesBetweenPriceLists,
  getAllRingBuilderInstances,
  parseRingBuilderConfig,
  ringPriceRowId,
  setRingPriceForPriceList,
  type RingBuilderConfig,
} from "@/lib/ring-builder-settings";
import { templateHasSlab } from "@/lib/structure-template-payload";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * The structure price sheets of the Pricing screen, read and written per
 * price list. The numbers live where they always did (the four structure
 * price tables and the ring builder settings); this is one way in to all of
 * them.
 */

/** Feet or inches without trailing zeros: 4, 2.5. */
function plainNumber(value: { toString(): string } | number): string {
  return String(Number(value));
}

function money(value: { toFixed(places: number): string }): string {
  return value.toFixed(2);
}

/** The list a row falls back on when the chosen list has no numbers for it. */
async function fallbackPriceListId(
  priceListId: string,
  client: DbClient,
): Promise<string | null> {
  const defaultId = await getDefaultPriceListId(client);
  return defaultId && defaultId !== priceListId ? defaultId : null;
}

function listIds(priceListId: string, fallbackId: string | null): string[] {
  return fallbackId ? [priceListId, fallbackId] : [priceListId];
}

/** Rows of one price table keyed by what they price, own list and fallback apart. */
function splitEntries<Entry extends { priceListId: string }>(
  entries: Entry[],
  priceListId: string,
  keyOf: (entry: Entry) => string,
): { own: Map<string, Entry>; fallback: Map<string, Entry> } {
  const own = new Map<string, Entry>();
  const fallback = new Map<string, Entry>();
  for (const entry of entries) {
    (entry.priceListId === priceListId ? own : fallback).set(keyOf(entry), entry);
  }
  return { own, fallback };
}

async function loadMoldRows(
  priceListId: string,
  fallbackId: string | null,
  client: DbClient,
): Promise<StructurePriceRow[]> {
  const molds = await client.structureDiameterConfig.findMany({
    orderBy: [{ sortOrder: "asc" }, { insideDiameterFeet: "asc" }],
  });
  const entries = await client.diameterPriceListEntry.findMany({
    where: { priceListId: { in: listIds(priceListId, fallbackId) } },
  });
  const { own, fallback } = splitEntries(entries, priceListId, (entry) => entry.diameterConfigId);
  return molds.map((mold) => {
    const ownEntry = own.get(mold.id);
    const fallbackEntry = fallback.get(mold.id);
    const diameter = `${plainNumber(mold.insideDiameterFeet)}' inside diameter`;
    return {
      id: mold.id,
      label: mold.label?.trim() || diameter,
      detail: mold.label?.trim() ? diameter : null,
      values: {
        wallPricePerFoot: ownEntry ? money(ownEntry.wallPricePerFoot) : null,
        basePrice: ownEntry ? money(ownEntry.basePrice) : null,
      },
      inherited: fallbackEntry
        ? {
            wallPricePerFoot: money(fallbackEntry.wallPricePerFoot),
            basePrice: money(fallbackEntry.basePrice),
          }
        : null,
      disabledColumns: [],
    };
  });
}

async function loadRectTemplateRows(
  priceListId: string,
  fallbackId: string | null,
  client: DbClient,
): Promise<StructurePriceRow[]> {
  const templates = await client.structureTemplate.findMany({
    where: { shape: "RECTANGULAR", status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      agencyStandard: true,
      topSlabThicknessInches: true,
      baseSlabThicknessInches: true,
      rectMinPricingHeightFeet: true,
    },
  });
  const entries = await client.rectTemplatePriceListEntry.findMany({
    where: { priceListId: { in: listIds(priceListId, fallbackId) } },
  });
  const { own, fallback } = splitEntries(entries, priceListId, (entry) => entry.templateId);
  return templates.map((template) => {
    const ownEntry = own.get(template.id);
    const fallbackEntry = fallback.get(template.id);
    const disabledColumns: string[] = [];
    if (!templateHasSlab(template.topSlabThicknessInches)) {
      disabledColumns.push("topSlabPrice");
    }
    if (!templateHasSlab(template.baseSlabThicknessInches)) {
      disabledColumns.push("baseSlabPrice");
    }
    return {
      id: template.id,
      label: template.name,
      detail: template.agencyStandard?.trim() || null,
      values: {
        wallPricePerFoot: ownEntry ? money(ownEntry.wallPricePerFoot) : null,
        topSlabPrice: ownEntry ? money(ownEntry.topSlabPrice) : null,
        baseSlabPrice: ownEntry ? money(ownEntry.baseSlabPrice) : null,
        minPricingHeightFeet:
          template.rectMinPricingHeightFeet != null
            ? money(template.rectMinPricingHeightFeet)
            : null,
      },
      inherited: fallbackEntry
        ? {
            wallPricePerFoot: money(fallbackEntry.wallPricePerFoot),
            topSlabPrice: money(fallbackEntry.topSlabPrice),
            baseSlabPrice: money(fallbackEntry.baseSlabPrice),
          }
        : null,
      disabledColumns,
    };
  });
}

async function loadBootRows(
  priceListId: string,
  fallbackId: string | null,
  client: DbClient,
): Promise<StructurePriceRow[]> {
  const sizes = await client.pipeOpeningSize.findMany({
    orderBy: [{ sortOrder: "asc" }, { pipeMaterial: "asc" }, { pipeSizeInches: "asc" }],
  });
  const entries = await client.pipeOpeningPriceListEntry.findMany({
    where: { priceListId: { in: listIds(priceListId, fallbackId) } },
  });
  const { own, fallback } = splitEntries(entries, priceListId, (entry) => entry.pipeOpeningSizeId);
  return sizes.map((size) => {
    const ownEntry = own.get(size.id);
    const fallbackEntry = fallback.get(size.id);
    // Older rows kept material and type apart; show them as one name.
    const material = [size.pipeMaterial, size.pipeType]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ");
    return {
      id: size.id,
      label: `${plainNumber(size.pipeSizeInches)}" ${material}`.trim(),
      detail: size.hasBoot
        ? size.bootModel?.trim()
          ? `Boot ${size.bootModel.trim()}`
          : "With boot"
        : "No boot",
      values: { pricePerBoot: ownEntry ? money(ownEntry.pricePerBoot) : null },
      inherited: fallbackEntry
        ? { pricePerBoot: money(fallbackEntry.pricePerBoot) }
        : null,
      disabledColumns: [],
    };
  });
}

async function loadRectOpeningRows(
  priceListId: string,
  fallbackId: string | null,
  client: DbClient,
): Promise<StructurePriceRow[]> {
  const sizes = await client.rectOpeningSize.findMany({
    orderBy: [{ sortOrder: "asc" }, { pipeMaterial: "asc" }, { pipeSizeInches: "asc" }],
  });
  const entries = await client.rectOpeningPriceListEntry.findMany({
    where: { priceListId: { in: listIds(priceListId, fallbackId) } },
  });
  const { own, fallback } = splitEntries(entries, priceListId, (entry) => entry.rectOpeningSizeId);
  return sizes.map((size) => {
    const ownEntry = own.get(size.id);
    const fallbackEntry = fallback.get(size.id);
    return {
      id: size.id,
      label: `${plainNumber(size.pipeSizeInches)}" ${size.pipeMaterial.trim()}`.trim(),
      detail: `${plainNumber(size.openingWidthInches)}" x ${plainNumber(size.openingHeightInches)}" opening`,
      values: { pricePerOpening: ownEntry ? money(ownEntry.pricePerOpening) : null },
      inherited: fallbackEntry
        ? { pricePerOpening: money(fallbackEntry.pricePerOpening) }
        : null,
      disabledColumns: [],
    };
  });
}

/** The ring builder settings straight from the database, not the settings cache. */
async function readRingBuilderConfig(client: DbClient): Promise<RingBuilderConfig> {
  const settings = await client.appSettings.findUnique({
    where: { id: "default" },
    select: { ringBuilderConfig: true },
  });
  return parseRingBuilderConfig(settings?.ringBuilderConfig);
}

async function loadRingRows(
  priceListId: string,
  client: DbClient,
): Promise<StructurePriceRow[]> {
  const config = await readRingBuilderConfig(client);
  return getAllRingBuilderInstances().map((instance) => {
    const mapping = config.find(
      (entry) =>
        entry.diameterFeet === instance.diameterFeet && entry.style === instance.style,
    );
    const ownPrice = mapping?.pricePerFootByPriceList[priceListId];
    const standardPrice = mapping?.defaultPricePerFoot ?? 0;
    return {
      id: ringPriceRowId(instance.diameterFeet, instance.style),
      label: instance.label,
      detail: null,
      values: { pricePerFoot: ownPrice !== undefined ? ownPrice.toFixed(2) : null },
      // A ring with no price on the list bills its standard price per foot
      // (Settings, Ring Builder), on the default list too.
      inherited: standardPrice > 0 ? { pricePerFoot: standardPrice.toFixed(2) } : null,
      disabledColumns: [],
    };
  });
}

async function loadTableRows(
  table: StructurePriceTableKey,
  priceListId: string,
  fallbackId: string | null,
  client: DbClient,
): Promise<StructurePriceRow[]> {
  switch (table) {
    case "molds":
      return loadMoldRows(priceListId, fallbackId, client);
    case "rectTemplates":
      return loadRectTemplateRows(priceListId, fallbackId, client);
    case "boots":
      return loadBootRows(priceListId, fallbackId, client);
    case "rectOpenings":
      return loadRectOpeningRows(priceListId, fallbackId, client);
    case "rings":
      return loadRingRows(priceListId, client);
  }
}

/** Every structure price sheet for one price list. */
export async function loadStructurePriceTables(
  priceListId: string,
  client: DbClient = prisma,
): Promise<StructurePriceTables> {
  const fallbackId = await fallbackPriceListId(priceListId, client);
  const tables = {} as StructurePriceTables;
  // Sequential: `client` may be a transaction client pinned to one connection.
  for (const table of STRUCTURE_PRICE_TABLE_KEYS) {
    tables[table] = await loadTableRows(table, priceListId, fallbackId, client);
  }
  return tables;
}

export type StructurePriceRowInput = {
  rowId: string;
  /** Every box of the row as typed, by column key. */
  values: Record<string, string | null>;
};

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

async function writeRow(
  table: Exclude<StructurePriceTableKey, "rings">,
  priceListId: string,
  rowId: string,
  prices: Record<string, string> | null,
  shared: Record<string, string | null>,
  tx: Prisma.TransactionClient,
): Promise<void> {
  switch (table) {
    case "molds": {
      if (!prices) {
        await tx.diameterPriceListEntry.deleteMany({
          where: { priceListId, diameterConfigId: rowId },
        });
        return;
      }
      const data = {
        wallPricePerFoot: decimal(prices.wallPricePerFoot),
        basePrice: decimal(prices.basePrice),
      };
      await tx.diameterPriceListEntry.upsert({
        where: { priceListId_diameterConfigId: { priceListId, diameterConfigId: rowId } },
        create: { priceListId, diameterConfigId: rowId, ...data },
        update: data,
      });
      return;
    }
    case "rectTemplates": {
      await tx.structureTemplate.update({
        where: { id: rowId },
        data: {
          rectMinPricingHeightFeet:
            shared.minPricingHeightFeet != null
              ? decimal(shared.minPricingHeightFeet)
              : null,
        },
      });
      if (!prices) {
        await tx.rectTemplatePriceListEntry.deleteMany({
          where: { priceListId, templateId: rowId },
        });
        return;
      }
      const data = {
        wallPricePerFoot: decimal(prices.wallPricePerFoot),
        topSlabPrice: decimal(prices.topSlabPrice),
        baseSlabPrice: decimal(prices.baseSlabPrice),
      };
      await tx.rectTemplatePriceListEntry.upsert({
        where: { priceListId_templateId: { priceListId, templateId: rowId } },
        create: { priceListId, templateId: rowId, ...data },
        update: data,
      });
      return;
    }
    case "boots": {
      if (!prices) {
        await tx.pipeOpeningPriceListEntry.deleteMany({
          where: { priceListId, pipeOpeningSizeId: rowId },
        });
        return;
      }
      const data = { pricePerBoot: decimal(prices.pricePerBoot) };
      await tx.pipeOpeningPriceListEntry.upsert({
        where: { priceListId_pipeOpeningSizeId: { priceListId, pipeOpeningSizeId: rowId } },
        create: { priceListId, pipeOpeningSizeId: rowId, ...data },
        update: data,
      });
      return;
    }
    case "rectOpenings": {
      if (!prices) {
        await tx.rectOpeningPriceListEntry.deleteMany({
          where: { priceListId, rectOpeningSizeId: rowId },
        });
        return;
      }
      const data = { pricePerOpening: decimal(prices.pricePerOpening) };
      await tx.rectOpeningPriceListEntry.upsert({
        where: { priceListId_rectOpeningSizeId: { priceListId, rectOpeningSizeId: rowId } },
        create: { priceListId, rectOpeningSizeId: rowId, ...data },
        update: data,
      });
      return;
    }
  }
}

/**
 * Save rows of one structure price sheet, inside the caller's transaction so
 * a pasted block lands whole or not at all. Returns the rows as they now
 * stand. Throws with a message for the person when a box cannot be read or a
 * row is gone.
 */
export async function saveStructurePriceRows(
  priceListId: string,
  table: StructurePriceTableKey,
  rows: StructurePriceRowInput[],
  tx: Prisma.TransactionClient,
): Promise<StructurePriceRow[]> {
  const fallbackId = await fallbackPriceListId(priceListId, tx);
  const current = new Map(
    (await loadTableRows(table, priceListId, fallbackId, tx)).map((row) => [row.id, row]),
  );

  // Last entry for a row wins, as it would typing its boxes twice.
  const inputByRowId = new Map<string, StructurePriceRowInput>();
  for (const input of rows) {
    inputByRowId.set(String(input?.rowId ?? ""), input);
  }

  let ringConfig = table === "rings" ? await readRingBuilderConfig(tx) : null;
  for (const [rowId, input] of inputByRowId) {
    const row = current.get(rowId);
    if (!row) {
      throw new Error(
        "A row on this screen no longer exists. Reload the page and try again.",
      );
    }
    const resolved = resolveStructurePriceRow(table, input.values ?? {}, row);
    if (!resolved.ok) {
      throw new Error(`${row.label}: ${resolved.error}`);
    }
    if (table === "rings") {
      const instance = getAllRingBuilderInstances().find(
        (ring) => ringPriceRowId(ring.diameterFeet, ring.style) === rowId,
      );
      if (!instance || !ringConfig) {
        throw new Error("That ring no longer exists. Reload the page and try again.");
      }
      ringConfig = setRingPriceForPriceList(
        ringConfig,
        instance.diameterFeet,
        instance.style,
        priceListId,
        resolved.prices ? Number(resolved.prices.pricePerFoot) : null,
      );
    } else {
      await writeRow(table, priceListId, rowId, resolved.prices, resolved.shared, tx);
    }
  }
  if (ringConfig) {
    await tx.appSettings.upsert({
      where: { id: "default" },
      update: { ringBuilderConfig: ringConfig },
      create: { ...DEFAULT_APP_SETTINGS_DATA, ringBuilderConfig: ringConfig },
    });
  }

  const saved = await loadTableRows(table, priceListId, fallbackId, tx);
  return saved.filter((row) => inputByRowId.has(row.id));
}

/**
 * Copy one price list's ring prices onto another, the way copying a price
 * list copies its other prices. Returns true when anything was copied, so
 * the caller knows to drop the settings cache.
 */
export async function copyRingPrices(
  targetPriceListId: string,
  sourcePriceListId: string,
  client: DbClient = prisma,
): Promise<boolean> {
  const config = await readRingBuilderConfig(client);
  if (!config.some((mapping) => sourcePriceListId in mapping.pricePerFootByPriceList)) {
    return false;
  }
  await client.appSettings.update({
    where: { id: "default" },
    data: {
      ringBuilderConfig: copyRingPricesBetweenPriceLists(
        config,
        sourcePriceListId,
        targetPriceListId,
      ),
    },
  });
  return true;
}
