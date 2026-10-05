"use client";

import type { Dispatch, SetStateAction } from "react";
import { isPositiveDeliveryQuantity } from "@/components/delivery-tickets/delivery-ticket-utils";
import {
  allocateRingsAcrossPools,
  drainRingQuantityKey,
  type DrainRingStyleMatrix,
} from "@/components/delivery-tickets/drain-ring-matrix-utils";
import {
  castingAssemblyEditorKey,
  formatCastingPieceRoleLabel,
  type CastingPieceRole,
} from "@/lib/casting-utils";
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";
import {
  isCompositeEditorKey,
  mapFulfillmentToLine,
  mergeFulfillmentIntoLine,
  structurePieceLineKey,
} from "./editor-utils";
import type { EditorLine } from "./types";

type QuoteLineEditingOptions = {
  setLines: Dispatch<SetStateAction<EditorLine[]>>;
  setSelectedLineIds: Dispatch<SetStateAction<Set<string>>>;
  linesByKey: Map<string, EditorLine>;
  getAvailableQty: (line: QuoteLineFulfillment) => number;
  isPickup: boolean;
  markDirty: () => void;
};

/**
 * JOB-ticket quote-line selection: the standard checkbox/quantity rows plus
 * the composite rows (drain ring SKUs, ADS pipe joint types, casting pieces,
 * split-structure pieces). Holds no state of its own — every handler writes
 * to the editor's `lines` / `selectedLineIds`.
 */
export function useQuoteLineEditing({
  setLines,
  setSelectedLineIds,
  linesByKey,
  getAvailableQty,
  isPickup,
  markDirty,
}: QuoteLineEditingOptions) {
  function toggleLine(meta: QuoteLineFulfillment, checked: boolean) {
    if (meta.isDrainRing || meta.isCastingAssembly || meta.isAdsPipe) {
      return;
    }
    if (checked) {
      setSelectedLineIds((current) => new Set([...current, meta.quoteLineItemId]));
      setLines((current) => {
        const existing = current.find((line) => line.key === meta.quoteLineItemId);
        if (existing) {
          return current.map((line) =>
            line.key === meta.quoteLineItemId
              ? {
                  ...mergeFulfillmentIntoLine(line, meta),
                  quantity: isPositiveDeliveryQuantity(line.quantity)
                    ? line.quantity
                    : String(getAvailableQty(meta)),
                }
              : line,
          );
        }
        return [
          ...current,
          mapFulfillmentToLine(meta, getAvailableQty(meta), isPickup),
        ];
      });
    } else {
      setSelectedLineIds((current) => {
        const next = new Set(current);
        next.delete(meta.quoteLineItemId);
        return next;
      });
      // Exact key match only — drain ring SKU lines use quoteLineItemId::productId keys.
      setLines((current) =>
        current.filter((line) => line.key !== meta.quoteLineItemId),
      );
    }
  }

  function setStandardLineQuantity(
    meta: QuoteLineFulfillment,
    value: string,
  ) {
    const hasValue = value.trim() !== "";
    const active = isPositiveDeliveryQuantity(value);

    setLines((current) => {
      const existing = current.find((line) => line.key === meta.quoteLineItemId);
      if (!hasValue) {
        return current.filter((line) => line.key !== meta.quoteLineItemId);
      }

      if (existing) {
        return current.map((line) =>
          line.key === meta.quoteLineItemId
            ? {
                ...mergeFulfillmentIntoLine(line, meta),
                quantity: value,
              }
            : line,
        );
      }

      return [
        ...current,
        {
          ...mapFulfillmentToLine(meta, meta.remainingQty, isPickup),
          quantity: value,
        },
      ];
    });

    setSelectedLineIds((current) => {
      const next = new Set(current);
      if (active) {
        next.add(meta.quoteLineItemId);
      } else {
        next.delete(meta.quoteLineItemId);
      }
      return next;
    });
  }

  function setDrainRingCount(
    meta: QuoteLineFulfillment,
    option: QuoteLineFulfillment["drainRingOptions"][number],
    value: string,
  ) {
    const key = drainRingQuantityKey(meta.quoteLineItemId, option.productId);
    const numeric = Number(value);
    const active = value.trim() !== "" && Number.isFinite(numeric) && numeric > 0;

    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (!active) {
        return current.filter((line) => line.key !== key);
      }
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: value } : line,
        );
      }
      return [
        ...current,
        {
          key,
          quoteLineItemId: meta.quoteLineItemId,
          productId: option.productId,
          jobStructureId: null,
          lineType: "STOCK_PRODUCT",
          itemCode: option.productCode,
          description: `${option.name} (${option.heightFeet}' ring)`,
          quantity: value,
          unit: "EA",
          weightEach: option.weightEach != null ? String(option.weightEach) : "",
          yardLocation: "",
        },
      ];
    });

    setSelectedLineIds((current) => {
      const next = new Set(current);
      if (active) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  /**
   * Auto-assign mode: replace every ring line in the matrix with a fresh
   * allocation of the desired totals. When no exact per-pool arrangement
   * exists but the group total fits (recorded pool splits lagging reality at
   * the end of a job), the allocation applies with overflow and an amber
   * warning — the over-quote confirm covers it at save time.
   */
  function applyAutoRingAssignment(
    matrix: DrainRingStyleMatrix,
    desiredCounts: Record<string, number>,
  ): { error: string | null; warning: string | null } {
    let warning: string | null = null;
    let result = allocateRingsAcrossPools(matrix, desiredCounts);
    if (!result.ok && result.kind === "arrangement") {
      const relaxed = allocateRingsAcrossPools(matrix, desiredCounts, {
        allowOverflow: true,
      });
      if (relaxed.ok) {
        result = relaxed;
        warning =
          "Recorded pool feet don't fit this split — some pools will run over. You'll confirm when saving.";
      }
    }
    if (!result.ok) {
      return { error: result.reason, warning: null };
    }

    const matrixLineIds = new Set(
      matrix.rows.map((row) => row.line.quoteLineItemId),
    );
    const nextLines = result.assignments.map(({ line, option, count }) => ({
      key: drainRingQuantityKey(line.quoteLineItemId, option.productId),
      quoteLineItemId: line.quoteLineItemId,
      productId: option.productId,
      jobStructureId: null,
      lineType: "STOCK_PRODUCT" as const,
      itemCode: option.productCode,
      description: `${option.name} (${option.heightFeet}' ring)`,
      quantity: String(count),
      unit: "EA",
      weightEach: option.weightEach != null ? String(option.weightEach) : "",
      yardLocation: "",
    }));

    const isMatrixRingKey = (line: EditorLine) =>
      isCompositeEditorKey(line.key) &&
      line.quoteLineItemId != null &&
      matrixLineIds.has(line.quoteLineItemId);

    setLines((current) => [
      ...current.filter((line) => !isMatrixRingKey(line)),
      ...nextLines,
    ]);
    setSelectedLineIds((current) => {
      const next = new Set(
        [...current].filter((key) => {
          const line = linesByKey.get(key);
          return !(line && isMatrixRingKey(line));
        }),
      );
      for (const line of nextLines) {
        next.add(line.key);
      }
      return next;
    });
    return { error: null, warning };
  }

  function getAdsPipeCount(quoteLineItemId: string, productId: string): string {
    const key = drainRingQuantityKey(quoteLineItemId, productId);
    return linesByKey.get(key)?.quantity ?? "";
  }

  function getAdsPipeQtyUsed(meta: QuoteLineFulfillment): number {
    return meta.adsPipeOptions.reduce((sum, option) => {
      const count =
        Number(getAdsPipeCount(meta.quoteLineItemId, option.productId)) || 0;
      return sum + count;
    }, 0);
  }

  function setAdsPipeCount(
    meta: QuoteLineFulfillment,
    option: QuoteLineFulfillment["adsPipeOptions"][number],
    value: string,
  ) {
    const key = drainRingQuantityKey(meta.quoteLineItemId, option.productId);
    const numeric = Number(value);
    const active = value.trim() !== "" && Number.isFinite(numeric) && numeric > 0;

    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (!active) {
        return current.filter((line) => line.key !== key);
      }
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: value } : line,
        );
      }
      return [
        ...current,
        {
          key,
          quoteLineItemId: meta.quoteLineItemId,
          productId: option.productId,
          jobStructureId: null,
          lineType: "STOCK_PRODUCT",
          itemCode: option.productCode,
          description: option.isSubstitute
            ? `${option.name} — substitute`
            : option.name,
          quantity: value,
          unit: meta.unit,
          weightEach: option.weightEach != null ? String(option.weightEach) : "",
          yardLocation: "",
        },
      ];
    });

    setSelectedLineIds((current) => {
      const next = new Set(current);
      if (active) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  function getCastingPieceCount(
    quoteLineItemId: string,
    pieceRole: CastingPieceRole,
  ): string {
    const key = castingAssemblyEditorKey(quoteLineItemId, pieceRole);
    return linesByKey.get(key)?.quantity ?? "";
  }

  function getCastingSetsUsed(meta: QuoteLineFulfillment): number {
    let sets = Number.POSITIVE_INFINITY;
    for (const option of meta.castingComponentOptions) {
      const count =
        Number(getCastingPieceCount(meta.quoteLineItemId, option.pieceRole)) || 0;
      sets = Math.min(sets, Math.floor(count / option.quantity));
    }
    return Number.isFinite(sets) ? sets : 0;
  }

  function setCastingPieceCount(
    meta: QuoteLineFulfillment,
    option: QuoteLineFulfillment["castingComponentOptions"][number],
    value: string,
  ) {
    const key = castingAssemblyEditorKey(meta.quoteLineItemId, option.pieceRole);
    const numeric = Number(value);
    const active = value.trim() !== "" && Number.isFinite(numeric) && numeric > 0;

    setLines((current) => {
      const existing = current.find((line) => line.key === key);
      if (!active) {
        return current.filter((line) => line.key !== key);
      }
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: value } : line,
        );
      }
      return [
        ...current,
        {
          key,
          quoteLineItemId: meta.quoteLineItemId,
          productId: option.productId,
          jobStructureId: null,
          lineType: "STOCK_PRODUCT",
          itemCode: option.productCode,
          description: `${option.name} (${formatCastingPieceRoleLabel(option.pieceRole)})`,
          quantity: value,
          unit: "EA",
          weightEach: option.weightEach != null ? String(option.weightEach) : "",
          yardLocation: "",
        },
      ];
    });

    setSelectedLineIds((current) => {
      const next = new Set(current);
      if (active) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  /** Whole sets: every component gets N × its per-set quantity. */
  function setCastingSets(meta: QuoteLineFulfillment, value: string) {
    const numeric = Number(value);
    const sets =
      value.trim() !== "" && Number.isFinite(numeric) && numeric > 0
        ? Math.floor(numeric)
        : 0;
    for (const option of meta.castingComponentOptions) {
      setCastingPieceCount(
        meta,
        option,
        sets > 0 ? String(sets * option.quantity) : "",
      );
    }
  }

  /** True when the piece counts form whole sets (nothing partial). */
  function castingPiecesAreEvenSets(meta: QuoteLineFulfillment): boolean {
    const sets = getCastingSetsUsed(meta);
    return meta.castingComponentOptions.every((option) => {
      const count =
        Number(getCastingPieceCount(meta.quoteLineItemId, option.pieceRole)) ||
        0;
      return count === sets * option.quantity;
    });
  }

  function toggleStructurePiece(
    meta: QuoteLineFulfillment,
    option: QuoteLineFulfillment["structurePieceOptions"][number],
    checked: boolean,
  ) {
    const key = structurePieceLineKey(meta.quoteLineItemId, option.pieceId);
    if (checked) {
      setLines((current) => {
        if (current.some((line) => line.key === key)) {
          return current;
        }
        return [
          ...current,
          {
            key,
            quoteLineItemId: meta.quoteLineItemId,
            productId: null,
            jobStructureId: meta.jobStructureId,
            jobStructurePieceId: option.pieceId,
            lineType: meta.lineType as EditorLine["lineType"],
            itemCode: meta.itemCode,
            description: `${meta.displayName} — ${option.name}`,
            quantity: "1",
            unit: "EA",
            weightEach: option.weightLbs != null ? String(option.weightLbs) : "",
            yardLocation: "",
          },
        ];
      });
      setSelectedLineIds((current) => new Set([...current, key]));
    } else {
      setLines((current) => current.filter((line) => line.key !== key));
      setSelectedLineIds((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
    markDirty();
  }

  return {
    toggleLine,
    setStandardLineQuantity,
    setDrainRingCount,
    applyAutoRingAssignment,
    getAdsPipeCount,
    getAdsPipeQtyUsed,
    setAdsPipeCount,
    getCastingPieceCount,
    getCastingSetsUsed,
    setCastingPieceCount,
    setCastingSets,
    castingPiecesAreEvenSets,
    toggleStructurePiece,
  };
}

export type QuoteLineEditing = ReturnType<typeof useQuoteLineEditing>;
