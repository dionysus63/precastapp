"use client";

import type { Dispatch, SetStateAction } from "react";
import { DrainRingMatrixRows } from "@/components/delivery-tickets/drain-ring-matrix";
import type { DrainRingDiameterGroup } from "@/components/delivery-tickets/drain-ring-matrix-utils";
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";
import {
  tableBodyClassName,
  tableClassName,
} from "@/lib/table-styles";
import {
  DASHBOARD_HEADER_HEIGHT,
  quoteLineTableCellClassName,
  quoteTableHeaderCellClassName,
} from "./editor-styles";
import { formatWeight } from "./editor-utils";
import {
  AdsPipeRow,
  CastingAssemblyRow,
  SplitStructureRow,
} from "./quote-line-rows";
import { StandardQuoteLineRow } from "./standard-quote-line-row";
import type { EditorLine } from "./types";
import type { QuoteLineEditing } from "./use-quote-line-editing";
import type { StructureSplitState } from "./use-structure-split";

type QuoteLinesTableProps = {
  fulfillment: QuoteLineFulfillment[];
  isPickup: boolean;
  drainRingDiameterGroups: DrainRingDiameterGroup[];
  editing: QuoteLineEditing;
  split: StructureSplitState;
  getAvailableQty: (line: QuoteLineFulfillment) => number;
  getOnOpenLoadsQty: (line: QuoteLineFulfillment) => number;
  linesByKey: Map<string, EditorLine>;
  selectedLineIds: Set<string>;
  setLines: Dispatch<SetStateAction<EditorLine[]>>;
  expandedCastingIds: Set<string>;
  setExpandedCastingIds: Dispatch<SetStateAction<Set<string>>>;
  totalWeight: number;
  loadCapacityLabel: string;
  stickyRegionHeight: number;
};

/** JOB ticket: the won quote's lines for this load — drain ring matrix on
 * top, then one row per quote line (casting / ADS / split / standard). */
export function QuoteLinesTable({
  fulfillment,
  isPickup,
  drainRingDiameterGroups,
  editing,
  split,
  getAvailableQty,
  getOnOpenLoadsQty,
  linesByKey,
  selectedLineIds,
  setLines,
  expandedCastingIds,
  setExpandedCastingIds,
  totalWeight,
  loadCapacityLabel,
  stickyRegionHeight,
}: QuoteLinesTableProps) {
  const quoteTableHeaderStyle = {
    top: `${DASHBOARD_HEADER_HEIGHT + stickyRegionHeight}px`,
  };

  return (
    <section
      style={{ marginTop: 0 }}
      className="w-full max-w-full rounded-b-xl border-x border-b border-slate-200/80 bg-white shadow-sm xl:w-fit"
    >
      {drainRingDiameterGroups.length > 0 ? (
        <table className={tableClassName}>
          <tbody className={tableBodyClassName}>
            <DrainRingMatrixRows
              groups={drainRingDiameterGroups}
              onQuantityChange={editing.setDrainRingCount}
              onAutoAssign={editing.applyAutoRingAssignment}
            />
          </tbody>
        </table>
      ) : null}

      <table className="w-full table-fixed border-separate border-spacing-0 text-left text-xs xl:max-w-[1500px]">
          <colgroup>
            <col style={{ width: "3.5%" }} />
            <col style={{ width: "31%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "6.5%" }} />
            <col style={{ width: "6.5%" }} />
            <col style={{ width: "6.5%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8.5%" }} />
            <col style={{ width: "6%" }} />
          </colgroup>
          <thead>
            <tr>
              <th
                className={`${quoteTableHeaderCellClassName} text-center`}
                style={quoteTableHeaderStyle}
              >
                Pick
              </th>
              <th
                className={quoteTableHeaderCellClassName}
                style={quoteTableHeaderStyle}
              >
                Item
              </th>
              {[
                "Remaining",
                "Qty on load",
                "Scheduled",
                "Shipped",
                "Awarded",
                "Weight each",
                "Line weight",
                "Status",
                "On hand",
              ].map((label) => (
                <th
                  key={label}
                  className={`${quoteTableHeaderCellClassName} text-center`}
                  style={quoteTableHeaderStyle}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={tableBodyClassName}>
            {fulfillment
              .filter((line) => !line.isDrainRing)
              // Freight lines never ride on a customer-pickup ticket.
              .filter((line) => !(isPickup && line.isDeliveryService))
              .map((line) => {
              if (line.isCastingAssembly) {
                return (
                  <CastingAssemblyRow
                    key={line.quoteLineItemId}
                    line={line}
                    getAvailableQty={getAvailableQty}
                    getOnOpenLoadsQty={getOnOpenLoadsQty}
                    getCastingSetsUsed={editing.getCastingSetsUsed}
                    castingPiecesAreEvenSets={editing.castingPiecesAreEvenSets}
                    getCastingPieceCount={editing.getCastingPieceCount}
                    setCastingSets={editing.setCastingSets}
                    setCastingPieceCount={editing.setCastingPieceCount}
                    expandedCastingIds={expandedCastingIds}
                    setExpandedCastingIds={setExpandedCastingIds}
                  />
                );
              }

              if (line.isAdsPipe) {
                return (
                  <AdsPipeRow
                    key={line.quoteLineItemId}
                    line={line}
                    getAvailableQty={getAvailableQty}
                    getOnOpenLoadsQty={getOnOpenLoadsQty}
                    getAdsPipeQtyUsed={editing.getAdsPipeQtyUsed}
                    getAdsPipeCount={editing.getAdsPipeCount}
                    setAdsPipeCount={editing.setAdsPipeCount}
                  />
                );
              }

              if (line.isSplitStructure) {
                return (
                  <SplitStructureRow
                    key={line.quoteLineItemId}
                    line={line}
                    selectedLineIds={selectedLineIds}
                    toggleStructurePiece={editing.toggleStructurePiece}
                    splitPending={split.splitPending}
                    splitError={split.splitError}
                    splitFormStructureId={split.splitFormStructureId}
                    removeSplit={split.removeSplit}
                  />
                );
              }

              return (
                <StandardQuoteLineRow
                  key={line.quoteLineItemId}
                  line={line}
                  editorLine={linesByKey.get(line.quoteLineItemId)}
                  checked={selectedLineIds.has(line.quoteLineItemId)}
                  getAvailableQty={getAvailableQty}
                  getOnOpenLoadsQty={getOnOpenLoadsQty}
                  toggleLine={editing.toggleLine}
                  setStandardLineQuantity={editing.setStandardLineQuantity}
                  setLines={setLines}
                  split={split}
                />
              );
            })}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50/80">
            <tr>
              <td colSpan={8} className={`${quoteLineTableCellClassName} text-right font-medium text-slate-700`}>
                Total load weight
              </td>
              <td className={`${quoteLineTableCellClassName} font-semibold text-slate-900`}>
                {totalWeight > 0 ? formatWeight(totalWeight) : "—"}
              </td>
              <td
                colSpan={2}
                className={`${quoteLineTableCellClassName} text-slate-500`}
              >
                Capacity: {loadCapacityLabel}
              </td>
            </tr>
          </tfoot>
      </table>
    </section>
  );
}
