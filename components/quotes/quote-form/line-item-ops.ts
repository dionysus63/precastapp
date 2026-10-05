import {
  type EditableQuoteLineItem,
  quoteLineItemTypeLabels,
} from "@/components/quotes/quote-utils";
import type { StagedStockProduct } from "@/components/quotes/stock-product-picker";
import {
  buildPipeUnitPricesDescription,
  isPipeUnitPricesLineItem,
  mergePipeUnitPriceEntries,
  parsePipeUnitPricesDescription,
  type PipeUnitPriceEntry,
} from "@/lib/pipe-quote-utils";
import {
  createLineId,
  renumberLineItems,
} from "@/components/quotes/quote-form/quote-form-utils";

/*
 * Pure list operations behind the quote form's line-item handlers. Each takes
 * the current lines and returns the next list, so they slot straight into
 * setLineItems((current) => ...).
 */

/** Empty category / note / page-break row appended by the toolbar buttons. */
export function createBlankLine(
  type: "CATEGORY" | "NOTE" | "PAGE_BREAK",
  lineNumber: number,
): EditableQuoteLineItem {
  return {
    id: createLineId(),
    lineNumber,
    type,
    typeLabel: quoteLineItemTypeLabels[type],
    item: "",
    description: "",
    qty: "1",
    unit: "",
    unitPrice: "0",
    weight: "",
    yards: "",
    taxable: false,
  };
}

/**
 * Pipe modal "unit prices" result: merges into the existing pipe unit-price
 * category line (moved to the end) or appends a new one.
 */
export function applyPipeUnitPrices(
  current: EditableQuoteLineItem[],
  entries: PipeUnitPriceEntry[],
): EditableQuoteLineItem[] {
  const existingIndex = current.findIndex(isPipeUnitPricesLineItem);
  let next = [...current];

  if (existingIndex >= 0) {
    const existing = current[existingIndex]!;
    const parsed = parsePipeUnitPricesDescription(existing.description);
    const merged = mergePipeUnitPriceEntries(
      parsed?.entries ?? [],
      entries,
    );
    const updatedLine: EditableQuoteLineItem = {
      ...existing,
      description: buildPipeUnitPricesDescription(merged),
    };
    next = next.filter((_, index) => index !== existingIndex);
    next.push(updatedLine);
  } else {
    next.push({
      id: createLineId(),
      lineNumber: current.length + 1,
      type: "CATEGORY",
      typeLabel: quoteLineItemTypeLabels.CATEGORY,
      item: "",
      description: buildPipeUnitPricesDescription(entries),
      qty: "1",
      unit: "",
      unitPrice: "0",
      weight: "",
      yards: "",
      taxable: false,
    });
  }

  return renumberLineItems(next);
}

/** Stock picker selections → stock product lines (line numbers assigned on append). */
export function stagedStockProductsToLineItems(
  items: StagedStockProduct[],
): EditableQuoteLineItem[] {
  return items.map(({ product, qty }) => ({
    id: createLineId(),
    lineNumber: 0,
    type: "STOCK_PRODUCT" as const,
    typeLabel: product.galleyFamilyCode
      ? "Galley Total"
      : quoteLineItemTypeLabels.STOCK_PRODUCT,
    item: product.code,
    // Family totals print the plain family name; the picker's
    // "(End/Middle/CB split on award)" hint is internal.
    description: product.galleyFamilyCode
      ? product.name
      : product.description,
    qty: String(qty),
    unit: product.unit,
    unitPrice: String(product.unitPrice),
    weight: product.weightLb > 0 ? String(product.weightLb) : "",
    yards: product.yards > 0 ? String(product.yards) : "",
    taxable: product.taxable,
    // Family options are synthetic — their id is not a productId.
    productId: product.galleyFamilyCode ? null : product.id,
    galleyFamilyCode: product.galleyFamilyCode ?? null,
  }));
}

/** Swap a line with its neighbour (up/down arrows). */
export function moveLineByStep(
  current: EditableQuoteLineItem[],
  id: string,
  direction: "up" | "down",
): EditableQuoteLineItem[] {
  const index = current.findIndex((line) => line.id === id);
  if (index < 0) {
    return current;
  }

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= current.length) {
    return current;
  }

  const next = [...current];
  [next[index], next[target]] = [next[target], next[index]];
  return renumberLineItems(next);
}

/** Drag-drop / jump-to-position: place the line at an exact index. */
export function moveLineToIndex(
  current: EditableQuoteLineItem[],
  id: string,
  targetIndex: number,
): EditableQuoteLineItem[] {
  const index = current.findIndex((line) => line.id === id);
  if (index < 0) {
    return current;
  }
  const clamped = Math.max(0, Math.min(current.length - 1, targetIndex));
  if (clamped === index) {
    return current;
  }
  const next = [...current];
  const [moved] = next.splice(index, 1);
  next.splice(clamped, 0, moved);
  return renumberLineItems(next);
}
