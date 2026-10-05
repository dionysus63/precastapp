import type { DeliveryTicketLineInput } from "@/app/delivery-tickets/actions";
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";
import { formatWeightLb } from "@/lib/format";
import { computeMoneyTotals } from "@/lib/money";
import { randomId } from "@/lib/random-id";
import type {
  EditorLine,
  JobOption,
  OverQuoteEntry,
  ProductOption,
  SplitDraftPiece,
} from "./types";

export function initialFleetSelect(
  value: string | null | undefined,
  options: string[],
) {
  if (!value) {
    return { selected: "", other: "" };
  }
  if (options.includes(value)) {
    return { selected: value, other: "" };
  }
  return { selected: "__other__", other: value };
}

export function resolveFleetValue(selected: string, other: string) {
  if (selected === "__other__") {
    return other.trim() || null;
  }
  return selected.trim() || null;
}

export function formatLineTypeLabel(lineType: string): string {
  return lineType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatWeight(value: number): string {
  return formatWeightLb(value);
}

export function parseEditorWeight(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function isCompositeEditorKey(key: string): boolean {
  return key.includes("::");
}

/** Lines that come from the job's quote (standard rows, structures and their
 * split pieces, casting pieces, drain-ring / ADS SKUs). Extras and walk-in
 * product lines carry none of these links. */
export function isQuoteDerivedEditorLine(line: EditorLine): boolean {
  return (
    line.quoteLineItemId != null ||
    line.jobStructureId != null ||
    line.jobStructurePieceId != null ||
    isCompositeEditorKey(line.key)
  );
}

/** Switching a ticket to Walk-in: drop every quote-derived line (and its
 * selection, including any pickup price override it carried); keep the
 * product / custom lines the user added. */
export function stripQuoteDerivedLines(
  lines: EditorLine[],
  selectedLineIds: Set<string>,
): { lines: EditorLine[]; selectedLineIds: Set<string> } {
  const kept = lines.filter((line) => !isQuoteDerivedEditorLine(line));
  const keptKeys = new Set(kept.map((line) => line.key));
  return {
    lines: kept,
    selectedLineIds: new Set(
      [...selectedLineIds].filter((key) => keptKeys.has(key)),
    ),
  };
}

export function getEffectiveWeightEach(
  editorLine: EditorLine | undefined,
  fulfillmentLine: QuoteLineFulfillment,
): number | null {
  const fromEditor = editorLine ? parseEditorWeight(editorLine.weightEach) : null;
  if (fromEditor != null) {
    return fromEditor;
  }
  // Composite lines (casting pieces, drain ring SKUs, structure pieces) point
  // to the parent line's fulfillment; don't fall back to the parent's weight
  // for an individual sub-line.
  if (editorLine && isCompositeEditorKey(editorLine.key)) {
    return null;
  }
  return fulfillmentLine.weightEach;
}

export function generateLineKey(): string {
  return randomId();
}

/** The price a product bills at for the given fulfillment: pickup tickets
 * take the FOB-yard price when one exists, otherwise the delivered price. */
export function productPriceFor(
  product: ProductOption,
  pickup: boolean,
): number | null {
  if (pickup && product.pickupPrice != null) {
    return product.pickupPrice;
  }
  return product.unitPrice ?? null;
}

export function mergeFulfillmentIntoLine(
  existing: EditorLine,
  meta: QuoteLineFulfillment,
): EditorLine {
  return {
    ...existing,
    productId: meta.productId,
    jobStructureId: meta.jobStructureId,
    lineType: meta.lineType as EditorLine["lineType"],
    itemCode: meta.itemCode,
    description: meta.description ?? "",
    unit: existing.unit.trim() ? existing.unit : meta.unit,
    weightEach: existing.weightEach.trim()
      ? existing.weightEach
      : meta.weightEach != null
        ? String(meta.weightEach)
        : "",
  };
}

export function mapFulfillmentToLine(
  meta: QuoteLineFulfillment,
  availableQty: number = meta.remainingQty,
  usePickupPrice = false,
): EditorLine {
  return {
    key: meta.quoteLineItemId,
    quoteLineItemId: meta.quoteLineItemId,
    productId: meta.productId,
    jobStructureId: meta.jobStructureId,
    lineType: meta.lineType as EditorLine["lineType"],
    itemCode: meta.itemCode,
    description: meta.description ?? "",
    quantity: meta.eligible && availableQty > 0 ? String(availableQty) : "0",
    unit: meta.unit,
    weightEach: meta.weightEach != null ? String(meta.weightEach) : "",
    // Pickup tickets bill the price list's pickup price when one exists;
    // the override lands in DeliveryTicketLineItem.unitPrice at save.
    unitPrice:
      usePickupPrice && meta.pickupUnitPrice != null
        ? String(meta.pickupUnitPrice)
        : undefined,
    yardLocation: "",
  };
}

export function fulfillmentMetaForEditorLine(
  line: EditorLine,
  fulfillmentById: Map<string, QuoteLineFulfillment>,
): QuoteLineFulfillment | undefined {
  if (isCompositeEditorKey(line.key)) {
    return line.quoteLineItemId
      ? fulfillmentById.get(line.quoteLineItemId)
      : undefined;
  }
  return fulfillmentById.get(line.key);
}

export function initialQuoteId(
  jobId: string,
  defaultQuoteId: string | null | undefined,
  jobs: JobOption[],
): string {
  const job = jobs.find((entry) => entry.id === jobId);
  if (!job || job.quotes.length === 0) {
    return "";
  }
  if (defaultQuoteId && job.quotes.some((entry) => entry.id === defaultQuoteId)) {
    return defaultQuoteId;
  }
  return job.quotes[0].id;
}

export function structurePieceLineKey(quoteLineItemId: string, pieceId: string) {
  return `${quoteLineItemId}::${pieceId}`;
}

export function buildSplitDraft(
  meta: QuoteLineFulfillment,
  count: number,
): SplitDraftPiece[] {
  const even =
    meta.weightEach != null && count > 0
      ? String(Math.round(meta.weightEach / count))
      : "";
  return Array.from({ length: count }, (_, index) => ({
    name: `Piece ${index + 1}`,
    weight: even,
  }));
}

/**
 * Lines on this load that exceed the quote's remaining quantity, mirroring
 * the checks validateLines runs on save. Structures are omitted — they stay
 * hard-capped server-side (a quoted structure is one physical piece).
 */
export function computeOverQuoteEntries(
  payloadLines: DeliveryTicketLineInput[],
  fulfillmentById: Map<string, QuoteLineFulfillment>,
  getAvailableQty: (line: QuoteLineFulfillment) => number,
): OverQuoteEntry[] {
  const round2 = (value: number) => Math.round(value * 100) / 100;
  const standardByLine = new Map<string, number>();
  const ringFeetByLine = new Map<string, number>();
  const adsQtyByLine = new Map<string, number>();
  const castingPiecesByLine = new Map<string, Map<string, number>>();

  for (const line of payloadLines) {
    if (!line.quoteLineItemId) continue;
    const meta = fulfillmentById.get(line.quoteLineItemId);
    if (!meta || meta.isSplitStructure) continue;
    if (
      line.lineType === "CONFIGURABLE_STRUCTURE" ||
      line.lineType === "CUSTOM_STRUCTURE"
    ) {
      continue;
    }
    if (meta.isDrainRing) {
      const option = meta.drainRingOptions.find(
        (entry) => entry.productId === line.productId,
      );
      if (!option) continue;
      ringFeetByLine.set(
        meta.quoteLineItemId,
        (ringFeetByLine.get(meta.quoteLineItemId) ?? 0) +
          option.heightFeet * line.quantity,
      );
    } else if (meta.isAdsPipe) {
      adsQtyByLine.set(
        meta.quoteLineItemId,
        (adsQtyByLine.get(meta.quoteLineItemId) ?? 0) + line.quantity,
      );
    } else if (meta.isCastingAssembly) {
      if (!line.productId) continue;
      const pieces =
        castingPiecesByLine.get(meta.quoteLineItemId) ??
        new Map<string, number>();
      pieces.set(
        line.productId,
        (pieces.get(line.productId) ?? 0) + line.quantity,
      );
      castingPiecesByLine.set(meta.quoteLineItemId, pieces);
    } else {
      standardByLine.set(
        meta.quoteLineItemId,
        (standardByLine.get(meta.quoteLineItemId) ?? 0) + line.quantity,
      );
    }
  }

  const entries: OverQuoteEntry[] = [];
  const push = (
    meta: QuoteLineFulfillment,
    unit: string,
    onLoad: number,
  ) => {
    entries.push({
      label: meta.displayName || meta.itemCode,
      unit,
      onLoad: round2(onLoad),
      available: getAvailableQty(meta),
    });
  };

  for (const [id, qty] of standardByLine) {
    const meta = fulfillmentById.get(id);
    if (meta && qty > getAvailableQty(meta)) push(meta, meta.unit, qty);
  }
  for (const [id, feet] of ringFeetByLine) {
    const meta = fulfillmentById.get(id);
    if (meta && feet > getAvailableQty(meta) + 0.001) push(meta, "LF", feet);
  }
  for (const [id, qty] of adsQtyByLine) {
    const meta = fulfillmentById.get(id);
    if (meta && qty > getAvailableQty(meta)) push(meta, meta.unit, qty);
  }
  for (const [id, pieces] of castingPiecesByLine) {
    const meta = fulfillmentById.get(id);
    if (!meta || meta.castingComponentOptions.length === 0) continue;
    let sets = Number.POSITIVE_INFINITY;
    for (const option of meta.castingComponentOptions) {
      const count = pieces.get(option.productId) ?? 0;
      sets = Math.min(sets, Math.floor(count / option.quantity));
    }
    // Collapsed whole-set lines carry the assembly product directly.
    const directSets = meta.productId
      ? Math.floor(pieces.get(meta.productId) ?? 0)
      : 0;
    const setsUsed = (Number.isFinite(sets) ? sets : 0) + directSets;
    if (setsUsed > getAvailableQty(meta)) push(meta, "sets", setsUsed);
  }
  return entries;
}

/** Walk-in money summary for the sticky bar and the lines-table footer. */
export function computeWalkInSummary(
  lines: EditorLine[],
  selectedLineIds: Set<string>,
  isWalkIn: boolean,
  defaultTaxRatePercent: number,
) {
  const walkInActiveLines = isWalkIn
    ? lines.filter(
        (line) =>
          selectedLineIds.has(line.key) && Number(line.quantity) > 0,
      )
    : [];
  const walkInPieceCount = walkInActiveLines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0),
    0,
  );
  const walkInSubtotal = walkInActiveLines.reduce((sum, line) => {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice ?? "");
    return line.unitPrice?.trim() && Number.isFinite(price) && price >= 0
      ? sum + qty * price
      : sum;
  }, 0);
  const walkInMissingPriceCount = walkInActiveLines.filter((line) => {
    const price = Number(line.unitPrice ?? "");
    return !line.unitPrice?.trim() || !Number.isFinite(price) || price < 0;
  }).length;
  // Same per-line cent rounding + tax math the invoice will use (walk-in
  // lines all bill taxable); unpriced lines are excluded like the subtotal.
  const walkInMoney = (() => {
    const pricedLines = walkInActiveLines.filter((line) => {
      const price = Number(line.unitPrice ?? "");
      return line.unitPrice?.trim() && Number.isFinite(price) && price >= 0;
    });
    const computed = computeMoneyTotals(
      pricedLines.map((line) => ({
        quantity: Number(line.quantity) || 0,
        unitPrice: Number(line.unitPrice),
        taxable: true,
      })),
      defaultTaxRatePercent,
    );
    return {
      salesTax: computed.salesTax.toNumber(),
      total: computed.total.toNumber(),
    };
  })();
  return {
    walkInPieceCount,
    walkInSubtotal,
    walkInMissingPriceCount,
    walkInMoney,
  };
}
