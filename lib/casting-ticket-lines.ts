// Casting assemblies ship as one ticket line per whole set (the assembly
// product, qty = sets) with any partial-set remainder as component piece
// lines. The editor and planner still work in pieces internally; these
// helpers convert at the save/load boundary. Legacy tickets that stored
// only piece lines keep working — every consumer also understands pieces.

import {
  formatCastingPieceRoleLabel,
  type CastingPieceRole,
} from "@/lib/casting-utils";

/** Structural subset of DeliveryTicketLineInput the collapse operates on. */
export type CastingCollapsibleLine = {
  quoteLineItemId?: string | null;
  productId?: string | null;
  jobStructureId?: string | null;
  jobStructurePieceId?: string | null;
  lineType: string;
  itemCode: string;
  description?: string | null;
  quantity: number;
  unit?: string;
  weightEach?: number | null;
  yardLocation?: string | null;
  notes?: string | null;
};

/** Structural subset of QuoteLineFulfillment needed to collapse. */
export type CastingCollapseMeta = {
  quoteLineItemId: string;
  /** The assembly product backing the quote line. */
  productId: string | null;
  itemCode: string;
  displayName: string;
  /** Weight of one complete set (assembly's own or parts-derived). */
  weightEach: number | null;
  castingComponentOptions: {
    productId: string;
    quantity: number;
    weightEach: number | null;
  }[];
};

/** Per-product per-set quantities (a product serving two roles is summed). */
function perSetByProduct(meta: CastingCollapseMeta): Map<string, number> {
  const map = new Map<string, number>();
  for (const option of meta.castingComponentOptions) {
    map.set(option.productId, (map.get(option.productId) ?? 0) + option.quantity);
  }
  return map;
}

function setWeightFor(meta: CastingCollapseMeta): number | null {
  if (meta.weightEach != null) {
    return meta.weightEach;
  }
  let total = 0;
  for (const option of meta.castingComponentOptions) {
    if (option.weightEach == null) {
      return null;
    }
    total += option.weightEach * option.quantity;
  }
  return meta.castingComponentOptions.length > 0 ? total : null;
}

/**
 * Replace each casting assembly's whole-set piece lines with a single
 * assembly line (qty = complete sets); partial-set leftovers stay as piece
 * lines. Lines that aren't casting pieces pass through untouched, in order.
 */
export function collapseCastingTicketLines<T extends CastingCollapsibleLine>(
  lines: T[],
  metas: CastingCollapseMeta[],
): T[] {
  const metaByQuoteLine = new Map(
    metas
      .filter((meta) => meta.productId && meta.castingComponentOptions.length > 0)
      .map((meta) => [meta.quoteLineItemId, meta]),
  );
  if (metaByQuoteLine.size === 0) {
    return lines;
  }

  // First pass: total piece quantities per assembly.
  const pieceTotals = new Map<string, Map<string, number>>();
  const isPieceLine = (line: T): CastingCollapseMeta | null => {
    if (!line.quoteLineItemId || !line.productId || line.jobStructureId) {
      return null;
    }
    const meta = metaByQuoteLine.get(line.quoteLineItemId);
    if (!meta || !perSetByProduct(meta).has(line.productId)) {
      return null;
    }
    return meta;
  };

  for (const line of lines) {
    const meta = isPieceLine(line);
    if (!meta) continue;
    const totals =
      pieceTotals.get(meta.quoteLineItemId) ?? new Map<string, number>();
    totals.set(
      line.productId!,
      (totals.get(line.productId!) ?? 0) + line.quantity,
    );
    pieceTotals.set(meta.quoteLineItemId, totals);
  }

  // Complete sets per assembly: min over components.
  const setsByQuoteLine = new Map<string, number>();
  for (const [quoteLineItemId, totals] of pieceTotals) {
    const meta = metaByQuoteLine.get(quoteLineItemId)!;
    let sets = Number.POSITIVE_INFINITY;
    for (const [productId, perSet] of perSetByProduct(meta)) {
      sets = Math.min(sets, Math.floor((totals.get(productId) ?? 0) / perSet));
    }
    setsByQuoteLine.set(
      quoteLineItemId,
      Number.isFinite(sets) && sets > 0 ? sets : 0,
    );
  }

  // Second pass: emit the assembly line at the first piece position, then
  // leftovers; later piece lines of an already-emitted assembly drop their
  // collapsed share.
  const result: T[] = [];
  const remainingByQuoteLine = new Map<string, Map<string, number>>();
  const emitted = new Set<string>();

  for (const line of lines) {
    const meta = isPieceLine(line);
    if (!meta) {
      result.push(line);
      continue;
    }
    const sets = setsByQuoteLine.get(meta.quoteLineItemId) ?? 0;
    if (sets <= 0) {
      result.push(line);
      continue;
    }

    if (!emitted.has(meta.quoteLineItemId)) {
      emitted.add(meta.quoteLineItemId);
      // Leftover pieces after removing whole sets.
      const totals = pieceTotals.get(meta.quoteLineItemId)!;
      const leftovers = new Map<string, number>();
      for (const [productId, perSet] of perSetByProduct(meta)) {
        const leftover = (totals.get(productId) ?? 0) - sets * perSet;
        if (leftover > 0) {
          leftovers.set(productId, leftover);
        }
      }
      remainingByQuoteLine.set(meta.quoteLineItemId, leftovers);

      result.push({
        ...line,
        productId: meta.productId,
        jobStructureId: null,
        jobStructurePieceId: null,
        lineType: "STOCK_PRODUCT",
        itemCode: meta.itemCode,
        description: meta.displayName,
        quantity: sets,
        unit: "EA",
        weightEach: setWeightFor(meta),
        yardLocation: null,
        notes: null,
      });
    }

    // This piece line's quantity beyond the collapsed sets stays behind.
    const leftovers = remainingByQuoteLine.get(meta.quoteLineItemId)!;
    const leftover = leftovers.get(line.productId!) ?? 0;
    if (leftover > 0) {
      const kept = Math.min(leftover, line.quantity);
      leftovers.set(line.productId!, leftover - kept);
      result.push({ ...line, quantity: kept });
    }
  }

  return result;
}

/** Role-level BOM row used to explode a stored assembly line for editing. */
export type CastingExplodeComponent = {
  productId: string;
  productCode: string;
  name: string;
  pieceRole: CastingPieceRole;
  /** Pieces of this role per set. */
  quantity: number;
  weightLb: number | null;
};

export type CastingExplodedPiece = {
  pieceRole: CastingPieceRole;
  productId: string;
  itemCode: string;
  description: string;
  quantity: number;
  weightEach: number | null;
};

/**
 * Explode a stored assembly line (qty = sets) into per-role piece entries —
 * the editor's internal representation.
 */
export function explodeAssemblyTicketLine(
  sets: number,
  components: CastingExplodeComponent[],
): CastingExplodedPiece[] {
  if (!Number.isFinite(sets) || sets <= 0) {
    return [];
  }
  return components.map((component) => ({
    pieceRole: component.pieceRole,
    productId: component.productId,
    itemCode: component.productCode,
    description: `${component.name} (${formatCastingPieceRoleLabel(component.pieceRole)})`,
    quantity: sets * component.quantity,
    weightEach: component.weightLb,
  }));
}
