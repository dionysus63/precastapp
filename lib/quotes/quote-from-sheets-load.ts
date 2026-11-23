import "server-only";

import type { QuoteStatus } from "@/app/generated/prisma/client";
import { QUOTE_PRODUCT_OPTION_SELECT } from "@/app/quotes/quote-form-data";
import {
  isPartsModeCastingAssembly,
  loadDerivedAssemblyValues,
  resolveEffectiveAssemblyWeight,
} from "@/lib/casting-service";
import {
  loadDrillSheetFormOptions,
  loadRectSheetFormOptions,
} from "@/lib/drill-sheet-options";
import { STRUCTURE_LINE_TYPES } from "@/lib/job-structure-workflow";
import { getProductPricesForList } from "@/lib/price-list-service";
import { withDatabaseRetry } from "@/lib/prisma";
import { mapProductToQuoteFormOption } from "@/lib/quote-mapper";
import {
  buildQuoteLinesFromSheets,
  splitSheetsForQuote,
  type LeftOutSheet,
  type QuoteFromSheetsResult,
  type SheetForQuote,
  type SheetQuoteRef,
} from "@/lib/quotes/quote-from-sheets";
import type { QuoteFormProductOption } from "@/lib/quotes/types";

/**
 * A quote in one of these states no longer speaks for its structures, so
 * its sheets can go on a new quote.
 */
const DEAD_QUOTE_STATUSES: QuoteStatus[] = [
  "LOST",
  "LOST_BC",
  "CANCELLED",
  "EXPIRED",
];

function toNumber(value: { toString(): string } | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A job's saved drill sheets as a quote needs them, in structure number
 * order (MH-2 before MH-10). `sheetIds` narrows it to those sheets.
 *
 * A sheet counts as already on a quote when it is linked to one (the quote
 * was won, or its sheets were made from the quote), or when a quote on the
 * job that is still alive has a structure line with the sheet's number: that
 * line takes the sheet over when the quote is won.
 */
export async function loadSheetsForQuote(
  jobId: string,
  sheetIds: string[] | null = null,
): Promise<SheetForQuote[]> {
  const [sheets, quotedLines] = await withDatabaseRetry((client) =>
    Promise.all([
      client.jobStructure.findMany({
        where: {
          jobId,
          calc: { isNot: null },
          structureTemplateId: { not: null },
          ...(sheetIds?.length ? { id: { in: sheetIds } } : {}),
        },
        orderBy: { createdAt: "asc" },
        include: {
          structureTemplate: { select: { name: true, shape: true } },
          calc: true,
          dimensions: true,
          openings: { orderBy: { openingNumber: "asc" } },
          castings: { orderBy: { createdAt: "asc" } },
          quote: { select: { id: true, quoteNumber: true } },
          quoteLineItems: {
            select: { quote: { select: { id: true, quoteNumber: true } } },
            take: 1,
          },
        },
      }),
      client.quoteLineItem.findMany({
        where: {
          lineType: { in: STRUCTURE_LINE_TYPES },
          jobStructureId: null,
          quote: { jobId, status: { notIn: DEAD_QUOTE_STATUSES } },
        },
        // Oldest first, so the newest quote with a number is the one named.
        orderBy: { quote: { createdAt: "asc" } },
        select: {
          itemCode: true,
          quote: { select: { id: true, quoteNumber: true } },
        },
      }),
    ]),
  );

  const quoteByNumber = new Map<string, SheetQuoteRef>();
  for (const line of quotedLines) {
    const code = line.itemCode.trim().toLowerCase();
    if (code) {
      quoteByNumber.set(code, line.quote);
    }
  }

  const mapped: SheetForQuote[] = [];
  for (const sheet of sheets) {
    const shape = sheet.structureTemplate?.shape;
    if (shape !== "CIRCULAR" && shape !== "RECTANGULAR") {
      continue;
    }
    const number = sheet.structureNumber?.trim().toLowerCase() ?? "";
    mapped.push({
      id: sheet.id,
      shape,
      templateName: sheet.structureTemplate?.name ?? "",
      description: sheet.description,
      structureTemplateId: sheet.structureTemplateId,
      structureNumber: sheet.structureNumber,
      quantity: toNumber(sheet.quantity) ?? 1,
      storedPrice: toNumber(sheet.calc?.totalPrice),
      weightLbs: toNumber(sheet.weight),
      calc: sheet.calc,
      dimensions: sheet.dimensions,
      openings: sheet.openings,
      castings: sheet.castings.map((casting) => ({
        castingProductId: casting.castingProductId,
        description: casting.castingDescription ?? casting.castingType,
        quantity: toNumber(casting.quantity) ?? 1,
      })),
      onQuote:
        sheet.quote ??
        sheet.quoteLineItems[0]?.quote ??
        (number ? (quoteByNumber.get(number) ?? null) : null),
    });
  }

  const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  return mapped.sort((a, b) =>
    collator.compare(a.structureNumber ?? "", b.structureNumber ?? ""),
  );
}

export type SheetsForQuoteSummary = {
  /** Saved sheets no quote has yet. */
  quotableCount: number;
  leftOut: LeftOutSheet[];
};

/** How many of a job's saved sheets a new quote would take, for the button. */
export async function summarizeSheetsForQuote(
  jobId: string,
  sheetIds: string[] | null = null,
): Promise<SheetsForQuoteSummary> {
  const { included, leftOut } = splitSheetsForQuote(
    await loadSheetsForQuote(jobId, sheetIds),
  );
  return { quotableCount: included.length, leftOut };
}

/** The casting products as the quote form's product picker would add them. */
async function loadCastingProductOptions(
  productIds: string[],
  priceListId: string | null,
): Promise<{
  options: Map<string, QuoteFormProductOption>;
  heights: { id: string; name: string; heightFeet: number | null }[];
}> {
  if (productIds.length === 0) {
    return { options: new Map(), heights: [] };
  }
  const products = await withDatabaseRetry((client) =>
    client.product.findMany({
      where: { id: { in: productIds } },
      select: { ...QUOTE_PRODUCT_OPTION_SELECT, heightFeet: true },
    }),
  );
  const partsAssemblyIds = products
    .filter((product) => isPartsModeCastingAssembly(product))
    .map((product) => product.id);
  const [priceMap, derivedMap] = await Promise.all([
    getProductPricesForList(productIds, priceListId),
    partsAssemblyIds.length
      ? withDatabaseRetry((client) =>
          loadDerivedAssemblyValues(client, partsAssemblyIds),
        )
      : new Map(),
  ]);

  const options = new Map<string, QuoteFormProductOption>();
  for (const product of products) {
    const effectiveWeight = resolveEffectiveAssemblyWeight(
      product,
      derivedMap.get(product.id),
    );
    options.set(
      product.id,
      mapProductToQuoteFormOption(
        {
          ...product,
          weight:
            effectiveWeight != null
              ? { toString: () => String(effectiveWeight) }
              : null,
        },
        priceMap.get(product.id),
      ),
    );
  }
  return {
    options,
    heights: products.map((product) => ({
      id: product.id,
      name: product.name,
      heightFeet: toNumber(product.heightFeet),
    })),
  };
}

/** Adds the sheets' own castings to a picker list that only has active ones. */
function withSheetCastings<Casting extends { id: string }>(
  castings: Casting[],
  extra: Casting[],
): Casting[] {
  const known = new Set(castings.map((casting) => casting.id));
  return [...castings, ...extra.filter((casting) => !known.has(casting.id))];
}

/**
 * The quote lines for a job's saved drill sheets, priced from `priceListId`
 * (the default list when null): the structures, then their castings. Reads
 * only: the quote is made when the New Quote form is saved.
 */
export async function loadQuoteLinesFromJobSheets(
  jobId: string,
  sheetIds: string[] | null,
  priceListId: string | null,
): Promise<QuoteFromSheetsResult> {
  const sheets = await loadSheetsForQuote(jobId, sheetIds);
  const { included } = splitSheetsForQuote(sheets);
  const templateIds = [
    ...new Set(
      included
        .filter((sheet) => sheet.shape === "CIRCULAR")
        .map((sheet) => sheet.structureTemplateId ?? "")
        .filter(Boolean),
    ),
  ];
  const castingProductIds = [
    ...new Set(
      included.flatMap((sheet) =>
        sheet.castings
          .map((casting) => casting.castingProductId ?? "")
          .filter(Boolean),
      ),
    ),
  ];

  const [circular, rect, castings] = await Promise.all([
    loadDrillSheetFormOptions(priceListId, { includeTemplateIds: templateIds }),
    loadRectSheetFormOptions(priceListId),
    loadCastingProductOptions(castingProductIds, priceListId),
  ]);

  return buildQuoteLinesFromSheets(sheets, {
    circular: {
      templates: circular.templateOptions,
      // A casting retired since the sheet was saved still sets its height.
      castings: withSheetCastings(circular.castingOptions, castings.heights),
      pipeOpeningSizes: circular.pipeOpeningSizes,
      diameterConfigs: circular.diameterConfigs,
    },
    rect: {
      templates: rect.templateOptions,
      castings: withSheetCastings(rect.castingOptions, castings.heights),
      openingSizes: rect.openingSizes,
    },
    castingProducts: castings.options,
  });
}
