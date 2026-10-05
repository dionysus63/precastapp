"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  getDeliveryLinePrimaryLabel,
  getDeliveryLineSecondaryLabel,
  shouldShowDeliveryLineDescription,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import { RichTextContent } from "@/components/ui/rich-text-content";
import {
  formatCastingPieceRoleLabel,
  type CastingPieceRole,
} from "@/lib/casting-utils";
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";
import {
  loadQuantityInputClass,
  quoteLineTableCellClassName,
} from "./editor-styles";
import { formatWeight, structurePieceLineKey } from "./editor-utils";

type CastingAssemblyRowProps = {
  line: QuoteLineFulfillment;
  getAvailableQty: (line: QuoteLineFulfillment) => number;
  getOnOpenLoadsQty: (line: QuoteLineFulfillment) => number;
  getCastingSetsUsed: (meta: QuoteLineFulfillment) => number;
  castingPiecesAreEvenSets: (meta: QuoteLineFulfillment) => boolean;
  getCastingPieceCount: (
    quoteLineItemId: string,
    pieceRole: CastingPieceRole,
  ) => string;
  setCastingSets: (meta: QuoteLineFulfillment, value: string) => void;
  setCastingPieceCount: (
    meta: QuoteLineFulfillment,
    option: QuoteLineFulfillment["castingComponentOptions"][number],
    value: string,
  ) => void;
  expandedCastingIds: Set<string>;
  setExpandedCastingIds: Dispatch<SetStateAction<Set<string>>>;
};

/** Casting assembly: whole sets on load, with an opt-in per-piece editor
 * for partial loads (auto-open when piece counts are already uneven). */
export function CastingAssemblyRow({
  line,
  getAvailableQty,
  getOnOpenLoadsQty,
  getCastingSetsUsed,
  castingPiecesAreEvenSets,
  getCastingPieceCount,
  setCastingSets,
  setCastingPieceCount,
  expandedCastingIds,
  setExpandedCastingIds,
}: CastingAssemblyRowProps) {
  const setsUsed = getCastingSetsUsed(line);
  const setsAvailable = getAvailableQty(line);
  const setsRemainingAfter = setsAvailable - setsUsed;
  const overLimit = setsUsed > setsAvailable + 0.001;
  const piecesEven = castingPiecesAreEvenSets(line);
  const piecesExpanded =
    !piecesEven ||
    expandedCastingIds.has(line.quoteLineItemId);
  return (
    <tr className="bg-slate-50/40">
      <td className={`${quoteLineTableCellClassName} align-top`} colSpan={11}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="font-medium text-slate-900">
              {line.displayName}
            </span>
            <span className="ml-2 text-slate-500">
              {line.itemCode}
            </span>
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
              Casting
            </span>
          </div>
          <div className="text-slate-600">
            {setsAvailable} of {line.quotedQty} EA remaining ·{" "}
            {getOnOpenLoadsQty(line)} scheduled ·{" "}
            {line.shippedQty} shipped
          </div>
        </div>
        {shouldShowDeliveryLineDescription(line) ? (
          <div className="mt-0.5 text-slate-500">
            <RichTextContent value={line.description ?? ""} />
          </div>
        ) : null}

        {line.castingComponentOptions.length === 0 ? (
          <p className="mt-2 text-slate-500">
            {line.eligibilityReason ??
              "No BOM components linked to this casting."}
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
                Sets on load
                <input
                  aria-label={`${line.displayName} sets on load`}
                  type="number"
                  min="0"
                  step="1"
                  value={piecesEven ? setsUsed || "" : ""}
                  placeholder={piecesEven ? "0" : "mixed"}
                  className={`w-20 ${loadQuantityInputClass}`}
                  onChange={(event) =>
                    setCastingSets(line, event.target.value)
                  }
                />
              </label>
              <span className="text-[10px] text-slate-400">
                1 set ={" "}
                {line.castingComponentOptions
                  .map(
                    (option) =>
                      `${option.quantity > 1 ? `${option.quantity}× ` : ""}${formatCastingPieceRoleLabel(option.pieceRole)}`,
                  )
                  .join(" + ")}
              </span>
              {piecesEven ? (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedCastingIds((current) => {
                      const next = new Set(current);
                      if (next.has(line.quoteLineItemId)) {
                        next.delete(line.quoteLineItemId);
                      } else {
                        next.add(line.quoteLineItemId);
                      }
                      return next;
                    })
                  }
                  className="rounded border border-slate-200 bg-white px-1.5 py-px text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  {piecesExpanded
                    ? "Hide pieces"
                    : "Adjust pieces"}
                </button>
              ) : (
                <span className="text-[10px] font-medium text-amber-600">
                  Partial set — piece counts differ
                </span>
              )}
            </div>
            {piecesExpanded ? (
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {line.castingComponentOptions.map((option) => (
                  <div
                    key={`${option.pieceRole}-${option.productId}`}
                    className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800">
                        {formatCastingPieceRoleLabel(option.pieceRole)} ·{" "}
                        {option.name}
                      </div>
                      <div className="truncate text-[10px] text-slate-500">
                        {option.productCode} ·{" "}
                        {option.currentStock != null
                          ? `${option.currentStock} on hand`
                          : "Not tracked"}
                        {option.quantity > 1
                          ? ` · ${option.quantity} per set`
                          : ""}
                      </div>
                    </div>
                    <input
                      aria-label={`${formatCastingPieceRoleLabel(option.pieceRole)} quantity on load`}
                      type="number"
                      min="0"
                      step="1"
                      value={getCastingPieceCount(
                        line.quoteLineItemId,
                        option.pieceRole,
                      )}
                      placeholder="0"
                      className={`w-full ${loadQuantityInputClass}`}
                      onChange={(event) =>
                        setCastingPieceCount(
                          line,
                          option,
                          event.target.value,
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
          <span>
            On load:{" "}
            <span className="font-semibold text-slate-900">
              {setsUsed} full set{setsUsed === 1 ? "" : "s"}
            </span>
          </span>
          <span
            className={
              overLimit
                ? "font-semibold text-red-600"
                : "text-slate-600"
            }
          >
            Remaining after load: {setsRemainingAfter} EA
          </span>
          {overLimit ? (
            <span className="font-semibold text-red-600">
              Exceeds remaining quantity
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

type AdsPipeRowProps = {
  line: QuoteLineFulfillment;
  getAvailableQty: (line: QuoteLineFulfillment) => number;
  getOnOpenLoadsQty: (line: QuoteLineFulfillment) => number;
  getAdsPipeQtyUsed: (meta: QuoteLineFulfillment) => number;
  getAdsPipeCount: (quoteLineItemId: string, productId: string) => string;
  setAdsPipeCount: (
    meta: QuoteLineFulfillment,
    option: QuoteLineFulfillment["adsPipeOptions"][number],
    value: string,
  ) => void;
};

/** ADS pipe quoted as soiltight: quantities per joint-type SKU. */
export function AdsPipeRow({
  line,
  getAvailableQty,
  getOnOpenLoadsQty,
  getAdsPipeQtyUsed,
  getAdsPipeCount,
  setAdsPipeCount,
}: AdsPipeRowProps) {
  const qtyUsed = getAdsPipeQtyUsed(line);
  const qtyAvailable = getAvailableQty(line);
  const qtyRemainingAfter =
    Math.round((qtyAvailable - qtyUsed) * 100) / 100;
  const overLimit = qtyUsed > qtyAvailable + 0.001;
  return (
    <tr className="bg-slate-50/40">
      <td className={`${quoteLineTableCellClassName} align-top`} colSpan={11}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="font-medium text-slate-900">
              {line.displayName}
            </span>
            <span className="ml-2 text-slate-500">
              {line.itemCode}
            </span>
            <span className="ml-2 text-slate-500">
              ADS pipe · Soiltight quoted
            </span>
          </div>
          <div className="text-slate-600">
            {qtyAvailable} of {line.quotedQty}{" "}
            {line.unit} remaining ·{" "}
            {getOnOpenLoadsQty(line)} scheduled ·{" "}
            {line.shippedQty} shipped
          </div>
        </div>
        {shouldShowDeliveryLineDescription(line) ? (
          <div className="mt-0.5 text-slate-500">
            <RichTextContent value={line.description ?? ""} />
          </div>
        ) : null}

        {line.adsPipeOptions.length === 0 ? (
          <p className="mt-2 text-slate-500">
            {line.eligibilityReason ??
              "No matching ADS pipe SKUs in catalog."}
          </p>
        ) : (
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {line.adsPipeOptions.map((option) => (
              <div
                key={option.productId}
                className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-800">
                    {option.jointTypeLabel}
                    <span className="ml-1 font-normal text-slate-400">
                      {option.productCode}
                    </span>
                  </div>
                  <div
                    className={`truncate text-[10px] ${
                      option.isSubstitute
                        ? "text-amber-700"
                        : "text-slate-500"
                    }`}
                  >
                    {option.currentStock != null
                      ? `${option.currentStock} on hand`
                      : "Not tracked"}
                    {option.isSubstitute
                      ? " · Substitute at quoted ST price"
                      : ""}
                  </div>
                </div>
                <input
                  aria-label={`${option.jointTypeLabel} pipe quantity on load`}
                  type="number"
                  min="0"
                  step="1"
                  value={getAdsPipeCount(
                    line.quoteLineItemId,
                    option.productId,
                  )}
                  placeholder="0"
                  className={`w-full ${loadQuantityInputClass}`}
                  onChange={(event) =>
                    setAdsPipeCount(
                      line,
                      option,
                      event.target.value,
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
          <span>
            On load:{" "}
            <span className="font-semibold text-slate-900">
              {qtyUsed} {line.unit}
            </span>
          </span>
          <span
            className={
              overLimit
                ? "font-semibold text-red-600"
                : "text-slate-600"
            }
          >
            Remaining after load: {qtyRemainingAfter} {line.unit}
          </span>
          {overLimit ? (
            <span className="font-semibold text-red-600">
              Exceeds remaining quantity
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

type SplitStructureRowProps = {
  line: QuoteLineFulfillment;
  selectedLineIds: Set<string>;
  toggleStructurePiece: (
    meta: QuoteLineFulfillment,
    option: QuoteLineFulfillment["structurePieceOptions"][number],
    checked: boolean,
  ) => void;
  splitPending: boolean;
  splitError: string | null;
  splitFormStructureId: string | null;
  removeSplit: (meta: QuoteLineFulfillment) => Promise<void>;
};

/** A structure already split for shipping: one checkbox per piece, plus
 * "Remove split" while no piece is claimed anywhere. */
export function SplitStructureRow({
  line,
  selectedLineIds,
  toggleStructurePiece,
  splitPending,
  splitError,
  splitFormStructureId,
  removeSplit,
}: SplitStructureRowProps) {
  const isConfigurableStructure =
    line.lineType === "CONFIGURABLE_STRUCTURE";
  const linePrimaryLabel = getDeliveryLinePrimaryLabel(line);
  const lineSecondaryLabel = getDeliveryLineSecondaryLabel(line);
  const claimedElsewhere = line.structurePieceOptions.filter(
    (option) =>
      option.deliveredTicketNumber || option.openTicketNumber,
  ).length;
  const selectedHere = line.structurePieceOptions.filter(
    (option) =>
      selectedLineIds.has(
        structurePieceLineKey(line.quoteLineItemId, option.pieceId),
      ),
  ).length;
  const canUnsplit =
    claimedElsewhere === 0 && selectedHere === 0;
  return (
    <tr className="bg-slate-50/40">
      <td className={`${quoteLineTableCellClassName} align-top`} colSpan={11}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span
              className={
                isConfigurableStructure
                  ? "text-sm font-bold text-slate-950"
                  : "font-medium text-slate-900"
              }
            >
              {linePrimaryLabel}
            </span>
            {isConfigurableStructure ? (
              lineSecondaryLabel ? (
                <span className="ml-2 text-slate-500">
                  {lineSecondaryLabel}
                </span>
              ) : null
            ) : (
              <span className="ml-2 text-slate-500">
                {line.itemCode}
              </span>
            )}
            <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-800">
              Split · {line.structurePieceOptions.length} pieces
            </span>
          </div>
          <div className="text-slate-600">
            {line.structurePieceOptions.filter((o) => o.deliveredTicketNumber).length}{" "}
            shipped · {claimedElsewhere} claimed ·{" "}
            {line.structurePieceOptions.length - claimedElsewhere - selectedHere}{" "}
            available
          </div>
        </div>
        {shouldShowDeliveryLineDescription(line) ? (
          <div className="mt-0.5 text-slate-500">
            <RichTextContent value={line.description ?? ""} />
          </div>
        ) : null}

        {!line.eligible && line.eligibilityReason ? (
          <p className="mt-2 text-slate-500">{line.eligibilityReason}</p>
        ) : null}

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {line.structurePieceOptions.map((option) => {
            const key = structurePieceLineKey(
              line.quoteLineItemId,
              option.pieceId,
            );
            const claimedBy =
              option.deliveredTicketNumber ?? option.openTicketNumber;
            const checked = selectedLineIds.has(key);
            return (
              <div
                key={option.pieceId}
                className={`rounded-lg border px-3 py-2 ${
                  claimedBy
                    ? "border-slate-100 bg-slate-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">
                    {option.name}
                  </span>
                  <span className="text-slate-400">
                    {option.weightLbs != null
                      ? formatWeight(option.weightLbs)
                      : "—"}
                  </span>
                </div>
                {claimedBy ? (
                  <p
                    className={`mt-1 text-[11px] font-medium ${
                      option.deliveredTicketNumber
                        ? "text-green-700"
                        : "text-sky-700"
                    }`}
                  >
                    {option.deliveredTicketNumber
                      ? `Delivered · ${option.deliveredTicketNumber}`
                      : `On ${option.openTicketNumber}`}
                  </p>
                ) : (
                  <label className="mt-1 flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={
                        !line.eligible && !checked
                      }
                      onChange={(event) =>
                        toggleStructurePiece(
                          line,
                          option,
                          event.target.checked,
                        )
                      }
                    />
                    On this load
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {canUnsplit ? (
            <button
              type="button"
              disabled={splitPending}
              onClick={() => void removeSplit(line)}
              className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-50"
            >
              Remove split (ship whole)
            </button>
          ) : null}
          {splitError && splitFormStructureId === null ? (
            <span className="text-[11px] text-red-600">{splitError}</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
