"use client";

import { SectionCard } from "@/components/dashboard/section-card";
import type { QuoteLineFulfillment } from "@/lib/delivery-fulfillment";
import { formatUsd } from "@/lib/format";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableHeaderCellClassName,
  tableInlineInputClassName,
} from "@/lib/table-styles";
import {
  fulfillmentMetaForEditorLine,
  isCompositeEditorKey,
} from "./editor-utils";
import type { EditorLine } from "./types";

type PickupPricingCardProps = {
  lines: EditorLine[];
  selectedLineIds: Set<string>;
  fulfillmentById: Map<string, QuoteLineFulfillment>;
  onApplyPickupListPrices: () => void;
  updateLine: (key: string, field: keyof EditorLine, value: string) => void;
  markDirty: () => void;
};

/** JOB ticket on customer pickup: per-line pickup price overrides vs the
 * quoted price, with the running ticket total and savings note. */
export function PickupPricingCard({
  lines,
  selectedLineIds,
  fulfillmentById,
  onApplyPickupListPrices,
  updateLine,
  markDirty,
}: PickupPricingCardProps) {
  return (
    <SectionCard
      title="Pickup pricing"
      description="Customer pickup — the quote's delivery charges stay off this ticket. Lines bill at the pickup price entered here; leave a price blank to bill as quoted."
    >
      {(() => {
        const pricedLines = lines.filter(
          (line) =>
            selectedLineIds.has(line.key) &&
            Number(line.quantity) > 0 &&
            line.quoteLineItemId,
        );
        if (pricedLines.length === 0) {
          return (
            <p className="text-xs text-slate-500">
              Pick lines above to price this pickup.
            </p>
          );
        }
        const rows = pricedLines.map((line) => {
          const meta = fulfillmentMetaForEditorLine(line, fulfillmentById);
          const composite = isCompositeEditorKey(line.key);
          const quotedEach =
            meta && !composite ? meta.quotedUnitPrice : null;
          const qty = Number(line.quantity) || 0;
          const overrideRaw = line.unitPrice?.trim() ?? "";
          const overrideEach =
            overrideRaw && Number.isFinite(Number(overrideRaw))
              ? Number(overrideRaw)
              : null;
          const effectiveEach = overrideEach ?? quotedEach;
          return {
            line,
            label: meta?.displayName ?? line.itemCode,
            itemCode: line.itemCode,
            quotedEach,
            pickupListEach:
              meta && !composite ? meta.pickupUnitPrice : null,
            qty,
            effectiveEach,
          };
        });
        const total = rows.reduce(
          (sum, row) =>
            row.effectiveEach != null
              ? sum + row.qty * row.effectiveEach
              : sum,
          0,
        );
        const savings = rows.reduce(
          (sum, row) =>
            row.quotedEach != null && row.effectiveEach != null
              ? sum + row.qty * (row.quotedEach - row.effectiveEach)
              : sum,
          0,
        );
        const hasListPrices = rows.some(
          (row) => row.pickupListEach != null,
        );
        return (
          <>
            {hasListPrices ? (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={onApplyPickupListPrices}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Apply price-list pickup prices
                </button>
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>Item</th>
                    <th className={`${tableHeaderCellClassName} text-center`}>
                      Qty
                    </th>
                    <th className={`${tableHeaderCellClassName} text-center`}>
                      Quoted each
                    </th>
                    <th className={`${tableHeaderCellClassName} text-center`}>
                      Pickup price each ($)
                    </th>
                    <th className={`${tableHeaderCellClassName} text-right`}>
                      Line total
                    </th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {rows.map((row) => (
                    <tr key={row.line.key}>
                      <td className={tableCellClassName}>
                        <div className="font-medium text-slate-900">
                          {row.label}
                        </div>
                        <div className="text-slate-500">{row.itemCode}</div>
                      </td>
                      <td className={`${tableCellClassName} text-center`}>
                        {row.qty} {row.line.unit}
                      </td>
                      <td
                        className={`${tableCellClassName} text-center ${
                          row.effectiveEach != null &&
                          row.quotedEach != null &&
                          row.effectiveEach < row.quotedEach
                            ? "text-slate-400 line-through"
                            : "text-slate-600"
                        }`}
                      >
                        {row.quotedEach != null
                          ? formatUsd(row.quotedEach)
                          : "—"}
                      </td>
                      <td className={`${tableCellClassName} text-center`}>
                        <input
                          aria-label={`${row.label} pickup price each`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.line.unitPrice ?? ""}
                          placeholder={
                            row.quotedEach != null
                              ? row.quotedEach.toFixed(2)
                              : "as quoted"
                          }
                          onChange={(event) => {
                            updateLine(
                              row.line.key,
                              "unitPrice",
                              event.target.value,
                            );
                            markDirty();
                          }}
                          className={`mx-auto w-28 ${tableInlineInputClassName} text-center`}
                        />
                      </td>
                      <td className={`${tableCellClassName} text-right font-medium text-slate-900`}>
                        {row.effectiveEach != null && row.qty > 0
                          ? formatUsd(row.qty * row.effectiveEach)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/80">
                    <td
                      colSpan={4}
                      className={`${tableCellClassName} text-right font-medium text-slate-700`}
                    >
                      {savings > 0.004 ? (
                        <span className="mr-3 font-normal text-green-700">
                          {formatUsd(savings)} below quoted — invoice will
                          note the pickup adjustment
                        </span>
                      ) : null}
                      Ticket total
                    </td>
                    <td className={`${tableCellClassName} text-right font-semibold text-slate-900`}>
                      {formatUsd(total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        );
      })()}
    </SectionCard>
  );
}
