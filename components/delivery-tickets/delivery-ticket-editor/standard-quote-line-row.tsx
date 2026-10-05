"use client";

import { Fragment, type Dispatch, type SetStateAction } from "react";
import {
  getDeliveryLinePrimaryLabel,
  getDeliveryLineSecondaryLabel,
  shouldShowDeliveryLineDescription,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import { RichTextContent } from "@/components/ui/rich-text-content";
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";
import {
  inlineTableInputClass,
  loadQuantityInputClass,
  quoteLineTableCellClassName,
} from "./editor-styles";
import {
  formatLineTypeLabel,
  formatWeight,
  getEffectiveWeightEach,
} from "./editor-utils";
import type { EditorLine } from "./types";
import type { StructureSplitState } from "./use-structure-split";

type StandardQuoteLineRowProps = {
  line: QuoteLineFulfillment;
  editorLine: EditorLine | undefined;
  checked: boolean;
  getAvailableQty: (line: QuoteLineFulfillment) => number;
  getOnOpenLoadsQty: (line: QuoteLineFulfillment) => number;
  toggleLine: (meta: QuoteLineFulfillment, checked: boolean) => void;
  setStandardLineQuantity: (meta: QuoteLineFulfillment, value: string) => void;
  setLines: Dispatch<SetStateAction<EditorLine[]>>;
  split: StructureSplitState;
};

/** A plain quote line (stock product, structure, service): pick checkbox,
 * load quantity, weight override, plus the inline "Split for shipping"
 * form for a single made structure. */
export function StandardQuoteLineRow({
  line,
  editorLine,
  checked,
  getAvailableQty,
  getOnOpenLoadsQty,
  toggleLine,
  setStandardLineQuantity,
  setLines,
  split,
}: StandardQuoteLineRowProps) {
  const {
    splitFormStructureId,
    setSplitFormStructureId,
    splitDraft,
    splitPending,
    splitError,
    openSplitForm,
    setSplitPieceCount,
    updateSplitDraft,
    saveSplit,
  } = split;
  const isConfigurableStructure =
    line.lineType === "CONFIGURABLE_STRUCTURE";
  const linePrimaryLabel = getDeliveryLinePrimaryLabel(line);
  const lineSecondaryLabel = getDeliveryLineSecondaryLabel(line);
  const qty = editorLine ? Number(editorLine.quantity) || 0 : 0;
  const effectiveWeightEach = getEffectiveWeightEach(editorLine, line);
  const lineWeight = qty * (effectiveWeightEach ?? 0);
  const weightInputValue = editorLine
    ? editorLine.weightEach.trim() ||
      (line.weightEach != null ? String(line.weightEach) : "")
    : "";
  return (
    <tr
      className={checked ? "bg-sky-50/70" : "hover:bg-slate-50/70"}
    >
      <td className={`${quoteLineTableCellClassName} align-top text-center`}>
        <input
          aria-label={`Select ${linePrimaryLabel}`}
          type="checkbox"
          checked={checked}
          disabled={!line.eligible}
          onChange={(event) => toggleLine(line, event.target.checked)}
        />
      </td>
      <td className={`${quoteLineTableCellClassName} align-top`}>
        {(() => {
          const canSplit =
            (line.lineType === "CONFIGURABLE_STRUCTURE" ||
              line.lineType === "CUSTOM_STRUCTURE") &&
            line.jobStructureId != null &&
            line.quotedQty === 1 &&
            line.jobStructureStatus === "MADE" &&
            line.remainingQty > 0;
          const splitFormOpen =
            canSplit &&
            splitFormStructureId === line.jobStructureId;
          return (
            <>
              <div
                className={
                  isConfigurableStructure
                    ? "text-sm font-bold leading-snug text-slate-950"
                    : "font-medium leading-snug text-slate-900"
                }
              >
                {linePrimaryLabel}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500">
                {isConfigurableStructure ? (
                  lineSecondaryLabel ? (
                    <span>{lineSecondaryLabel}</span>
                  ) : null
                ) : (
                  <span>{line.itemCode}</span>
                )}
                {line.lineType !== "STOCK_PRODUCT" ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {formatLineTypeLabel(line.lineType)}
                  </span>
                ) : null}
                {canSplit && !splitFormOpen ? (
                  <button
                    type="button"
                    onClick={() => openSplitForm(line)}
                    className="rounded border border-slate-200 bg-white px-1.5 py-px text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Split for shipping
                  </button>
                ) : null}
              </div>
              {shouldShowDeliveryLineDescription(line) ? (
                <div className="mt-0.5 text-slate-500">
                  <RichTextContent
                    value={line.description ?? ""}
                  />
                </div>
              ) : null}
              {splitFormOpen ? (
                <div className="mt-2 max-w-md rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-medium text-slate-700">
                      Pieces
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="12"
                      value={splitDraft.length}
                      onChange={(event) =>
                        setSplitPieceCount(
                          line,
                          Number(event.target.value) || 2,
                        )
                      }
                      className={`w-16 ${inlineTableInputClass}`}
                    />
                    <span className="text-[10px] text-slate-400">
                      Names + optional weight each (lb)
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_6rem] gap-1.5">
                    {splitDraft.map((piece, index) => (
                      <Fragment key={index}>
                        <input
                          value={piece.name}
                          onChange={(event) =>
                            updateSplitDraft(index, "name", event.target.value)
                          }
                          placeholder={`Piece ${index + 1}`}
                          className={inlineTableInputClass}
                        />
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={piece.weight}
                          onChange={(event) =>
                            updateSplitDraft(index, "weight", event.target.value)
                          }
                          placeholder="lb"
                          className={inlineTableInputClass}
                        />
                      </Fragment>
                    ))}
                  </div>
                  {splitError ? (
                    <p className="mt-2 text-[11px] text-red-600">{splitError}</p>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={splitPending}
                      onClick={() => void saveSplit(line)}
                      className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                    >
                      {splitPending
                        ? "Splitting…"
                        : `Create ${splitDraft.length} pieces`}
                    </button>
                    <button
                      type="button"
                      disabled={splitPending}
                      onClick={() => setSplitFormStructureId(null)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          );
        })()}
      </td>
      <td className={`${quoteLineTableCellClassName} align-top text-center font-medium text-slate-900`}>
        {getAvailableQty(line)}
      </td>
      <td className={`${quoteLineTableCellClassName} align-top text-center`}>
        <input
          aria-label={`${linePrimaryLabel} quantity on load`}
          type="number"
          min="0"
          max={getAvailableQty(line)}
          step="any"
          value={editorLine?.quantity ?? ""}
          placeholder="0"
          disabled={!line.eligible}
          className={`mx-auto w-full max-w-20 ${loadQuantityInputClass}`}
          onChange={(event) =>
            setStandardLineQuantity(line, event.target.value)
          }
        />
      </td>
      <td className={`${quoteLineTableCellClassName} align-top text-center text-slate-600`}>
        {getOnOpenLoadsQty(line)}
      </td>
      <td className={`${quoteLineTableCellClassName} align-top text-center text-slate-600`}>
        {line.shippedQty}
      </td>
      <td className={`${quoteLineTableCellClassName} align-top text-center text-slate-600`}>
        {line.quotedQty}
      </td>
      <td className={`${quoteLineTableCellClassName} align-top text-center text-slate-700`}>
        {checked && editorLine ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={weightInputValue}
            placeholder="—"
            className={`mx-auto w-full max-w-24 ${inlineTableInputClass}`}
            onChange={(event) =>
              setLines((current) =>
                current.map((row) =>
                  row.key === line.quoteLineItemId
                    ? { ...row, weightEach: event.target.value }
                    : row,
                ),
              )
            }
          />
        ) : line.weightEach != null ? (
          formatWeight(line.weightEach)
        ) : (
          "—"
        )}
      </td>
      <td className={`${quoteLineTableCellClassName} align-top text-center font-medium text-slate-900`}>
        {checked && lineWeight > 0 ? formatWeight(lineWeight) : "—"}
      </td>
      <td className={`${quoteLineTableCellClassName} align-top text-center text-slate-600`}>
        {line.eligible
          ? (line.eligibilityReason ?? "Ready")
          : (line.eligibilityReason ?? "Not ready")}
      </td>
      <td
        className={`${quoteLineTableCellClassName} align-top text-center text-slate-700`}
      >
        {line.currentStock != null ? (
          <>
            <span className="font-semibold text-slate-900">
              {line.currentStock}
            </span>{" "}
            {line.unit}
          </>
        ) : line.lineType === "STOCK_PRODUCT" ? (
          <span className="text-slate-400">Not tracked</span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}
