// Quote lines from a job's saved drill sheets: one structure line per sheet,
// then the castings as their own lines. This is the job page's Quick Build →
// Create Quote button. Nothing here saves anything: the lines fill the New
// Quote form, and the quote exists only once that form is saved.
//
// The structure lines are the same lines the quote's structure workbooks
// write (same price math, same stored config), so marking the quote Won
// attaches each line to the sheet it came from by its number instead of
// making a second structure (see linkJobStructuresFromQuoteInTransaction).
//
// Pure, so the rules are unit-testable; the database side is in
// quote-from-sheets-load.ts.

import {
  mapCircularSheetToWorkbookRow,
  mapRectSheetToWorkbookRow,
  type StoredSheetForImport,
} from "@/lib/quotes/job-sheet-import";
import { quoteLineItemTypeLabels } from "@/lib/quotes/constants";
import {
  computeRectWorkbookRow,
  formatRectStructureDescription,
  rectWorkbookRowToLineItem,
  type RectQuoteStructureConfig,
  type RectWorkbookOptions,
} from "@/lib/quotes/rect-structure-workbook";
import {
  commitWorkbookRowPrice,
  createRowId,
  formatStructureDescription,
  workbookRowToLineItem,
  type QuoteStructureConfig,
  type StructureWorkbookOptions,
} from "@/lib/quotes/structure-workbook";
import type {
  EditableQuoteLineItem,
  QuoteFormProductOption,
} from "@/lib/quotes/types";

/** A quote a sheet is already on. */
export type SheetQuoteRef = { id: string; quoteNumber: string };

/** One saved drill sheet, with what a quote line needs from it. */
export type SheetForQuote = StoredSheetForImport & {
  id: string;
  shape: "CIRCULAR" | "RECTANGULAR";
  templateName: string;
  description: string | null;
  /** How many of this structure the job has (1 unless it was changed). */
  quantity: number;
  /** The price worked out when the sheet was last saved. */
  storedPrice: number | null;
  weightLbs: number | null;
  castings: {
    castingProductId: string | null;
    description: string | null;
    /** Castings on one structure. */
    quantity: number;
  }[];
  /** Set when one of the job's quotes already has this structure. */
  onQuote: SheetQuoteRef | null;
};

export type QuoteFromSheetsOptions = {
  circular: StructureWorkbookOptions;
  rect: RectWorkbookOptions;
  /** The casting products the sheets use, priced from the quote's list. */
  castingProducts: Map<string, QuoteFormProductOption>;
};

export type LeftOutSheet = {
  structureNumber: string;
  quote: SheetQuoteRef;
};

export type QuoteFromSheetsResult = {
  lineItems: EditableQuoteLineItem[];
  structureCount: number;
  /** Sheets already on a quote, so not put on this one. */
  leftOut: LeftOutSheet[];
  /** Lines that came in at $0.00 for want of a price, by what they are. */
  unpriced: string[];
};

function sheetLabel(sheet: SheetForQuote): string {
  return sheet.structureNumber?.trim() || "Structure";
}

/** Sheets no quote has yet, and the ones that are already on one. */
export function splitSheetsForQuote(sheets: SheetForQuote[]): {
  included: SheetForQuote[];
  leftOut: LeftOutSheet[];
} {
  const included: SheetForQuote[] = [];
  const leftOut: LeftOutSheet[] = [];
  for (const sheet of sheets) {
    if (sheet.onQuote) {
      leftOut.push({ structureNumber: sheetLabel(sheet), quote: sheet.onQuote });
    } else {
      included.push(sheet);
    }
  }
  return { included, leftOut };
}

/**
 * The workbook's own note says to create the sheet after award. These
 * structures already have theirs.
 */
const SHEET_ON_JOB_NOTE = "Drill sheet saved on the job.";

function quantityText(quantity: number): string {
  return Number.isFinite(quantity) && quantity > 0 ? String(quantity) : "1";
}

/**
 * The line for a sheet the workbook math could not price (its template was
 * retired, or the sheet no longer calculates): the price from when the sheet
 * was last saved, or $0.00 when it has none.
 */
function fallbackStructureLine(
  sheet: SheetForQuote,
  config: QuoteStructureConfig | RectQuoteStructureConfig | null,
): EditableQuoteLineItem {
  const isRect = sheet.shape === "RECTANGULAR";
  const description = config
    ? isRect
      ? formatRectStructureDescription(config as RectQuoteStructureConfig)
      : formatStructureDescription(config as QuoteStructureConfig)
    : sheet.description?.trim() || sheet.templateName || "Structure";
  return {
    id: createRowId(),
    lineNumber: 0,
    type: "CONFIGURABLE_STRUCTURE",
    typeLabel: quoteLineItemTypeLabels.CONFIGURABLE_STRUCTURE,
    item: sheetLabel(sheet),
    description,
    qty: quantityText(sheet.quantity),
    unit: "EA",
    unitPrice: (sheet.storedPrice ?? 0).toFixed(2),
    weight: sheet.weightLbs != null ? String(sheet.weightLbs) : "",
    yards: "",
    taxable: true,
    statusNote: SHEET_ON_JOB_NOTE,
    ...(config
      ? isRect
        ? { rectStructureConfig: config as RectQuoteStructureConfig }
        : { structureConfig: config as QuoteStructureConfig }
      : {}),
  };
}

/** One saved sheet as a quote structure line, priced from the price list. */
export function sheetToQuoteLine(
  sheet: SheetForQuote,
  options: Pick<QuoteFromSheetsOptions, "circular" | "rect">,
): EditableQuoteLineItem {
  const qty = quantityText(sheet.quantity);
  if (sheet.shape === "RECTANGULAR") {
    const row = computeRectWorkbookRow(
      { ...mapRectSheetToWorkbookRow(sheet), qty },
      options.rect,
      "FULL",
    );
    const line = rectWorkbookRowToLineItem(row, 0);
    return line
      ? { ...line, statusNote: SHEET_ON_JOB_NOTE }
      : fallbackStructureLine(sheet, row.config);
  }
  const row = commitWorkbookRowPrice(
    { ...mapCircularSheetToWorkbookRow(sheet), qty },
    options.circular,
    "DRILL_SHEET",
  );
  const line = workbookRowToLineItem(row, 0);
  return line
    ? { ...line, statusNote: SHEET_ON_JOB_NOTE }
    : fallbackStructureLine(sheet, row.structureConfig);
}

/**
 * The sheets' castings as quote lines: one line per casting with the count
 * across every sheet, in the order the castings first appear.
 */
export function castingLinesForSheets(
  sheets: SheetForQuote[],
  castingProducts: QuoteFromSheetsOptions["castingProducts"],
): EditableQuoteLineItem[] {
  const groups = new Map<
    string,
    { productId: string | null; description: string; quantity: number }
  >();
  for (const sheet of sheets) {
    for (const casting of sheet.castings) {
      const description = casting.description?.trim() ?? "";
      if (!casting.castingProductId && !description) {
        continue;
      }
      // A casting whose product was since deleted still counts: it groups
      // by the name the sheet kept.
      const key = casting.castingProductId ?? `name:${description.toLowerCase()}`;
      const count =
        (casting.quantity > 0 ? casting.quantity : 1) *
        (sheet.quantity > 0 ? sheet.quantity : 1);
      const group = groups.get(key);
      if (group) {
        group.quantity += count;
      } else {
        groups.set(key, {
          productId: casting.castingProductId,
          description,
          quantity: count,
        });
      }
    }
  }

  return [...groups.values()].map((group) => {
    const product = group.productId
      ? castingProducts.get(group.productId)
      : undefined;
    if (!product) {
      return {
        id: createRowId(),
        lineNumber: 0,
        type: "MISC" as const,
        typeLabel: quoteLineItemTypeLabels.MISC,
        item: "CASTING",
        description: group.description || "Casting",
        qty: String(group.quantity),
        unit: "EA",
        unitPrice: "0.00",
        weight: "",
        yards: "",
        taxable: true,
        productId: null,
      };
    }
    // Same fields the quote form's product picker fills.
    return {
      id: createRowId(),
      lineNumber: 0,
      type: "STOCK_PRODUCT" as const,
      typeLabel: quoteLineItemTypeLabels.STOCK_PRODUCT,
      item: product.code,
      description: product.description,
      qty: String(group.quantity),
      unit: product.unit,
      unitPrice: String(product.unitPrice),
      weight: product.weightLb > 0 ? String(product.weightLb) : "",
      yards: product.yards > 0 ? String(product.yards) : "",
      taxable: product.taxable,
      productId: product.id,
    };
  });
}

function isUnpriced(line: EditableQuoteLineItem): boolean {
  const price = Number(line.unitPrice);
  return !Number.isFinite(price) || price <= 0;
}

/**
 * Every line for a quote made from saved sheets: the structures in the
 * order given, then the castings. Sheets already on a quote are left out and
 * listed, and so is every line that has no price yet.
 */
export function buildQuoteLinesFromSheets(
  sheets: SheetForQuote[],
  options: QuoteFromSheetsOptions,
): QuoteFromSheetsResult {
  const { included, leftOut } = splitSheetsForQuote(sheets);
  const structureLines = included.map((sheet) =>
    sheetToQuoteLine(sheet, options),
  );
  const castingLines = castingLinesForSheets(included, options.castingProducts);
  const lineItems = [...structureLines, ...castingLines].map((line, index) => ({
    ...line,
    lineNumber: index + 1,
  }));
  return {
    lineItems,
    structureCount: structureLines.length,
    leftOut,
    unpriced: lineItems
      .filter(isUnpriced)
      .map((line) =>
        line.type === "CONFIGURABLE_STRUCTURE"
          ? line.item
          : line.description || line.item,
      ),
  };
}

/** "MH-1, MH-2 and MH-3", or "MH-1, MH-2 and 4 more" past `max` names. */
export function joinNames(names: string[], max = 6): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }
  if (names.length > max) {
    const shown = names.slice(0, max - 1);
    return `${shown.join(", ")} and ${names.length - shown.length} more`;
  }
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The notes shown above a quote form that was filled from saved sheets. */
export function quoteFromSheetsNotes(
  result: QuoteFromSheetsResult,
  jobNumber: string,
): { info: string; warnings: string[] } {
  const structures = `${result.structureCount} structure${result.structureCount === 1 ? "" : "s"}`;
  const info =
    result.structureCount > 0
      ? `Filled from ${structures} saved in Quick Build on ${jobNumber}, with ${result.structureCount === 1 ? "its casting" : "their castings"} below. Nothing is saved until you save this quote.`
      : `No saved Quick Build sheets on ${jobNumber} were left to quote.`;
  const warnings: string[] = [];
  if (result.unpriced.length > 0) {
    warnings.push(
      `No price was found for ${joinNames(result.unpriced)}. ${result.unpriced.length === 1 ? "That line is" : "Those lines are"} at $0.00: type the price in.`,
    );
  }
  const quotes = new Map<string, string[]>();
  for (const sheet of result.leftOut) {
    const names = quotes.get(sheet.quote.quoteNumber) ?? [];
    names.push(sheet.structureNumber);
    quotes.set(sheet.quote.quoteNumber, names);
  }
  for (const [quoteNumber, names] of quotes) {
    warnings.push(
      `Left out, already on quote ${quoteNumber}: ${joinNames(names)}.`,
    );
  }
  return { info, warnings };
}
