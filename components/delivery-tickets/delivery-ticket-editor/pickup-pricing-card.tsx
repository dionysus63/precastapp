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
  updateLine: (key: string, field: keyof EditorLine, value: string) => void;
  markDirty: () => void;
};

/**
 * The per-unit prices of a quote line on this pickup: as quoted, and what a
 * pickup bills (lib/pricing/load-price.ts). A ring SKU line prices by its
 * height off the quote's per-foot price; other pieces of a line (casting
 * parts, structure pieces) are billed with their set or structure.
 */
function pickupPricesFor(
  line: EditorLine,
  meta: QuoteLineFulfillment | undefined,
): { quotedEach: number | null; pickupEach: number | null } {
  if (!meta) {
    return { quotedEach: null, pickupEach: null };
  }
  if (!isCompositeEditorKey(line.key)) {
    return {
      quotedEach: meta.quotedUnitPrice,
      pickupEach: meta.loadUnitPrice.PICKUP,
    };
  }
  const ring = meta.isDrainRing
    ? meta.drainRingOptions.find((option) => option.productId === line.productId)
    : undefined;
  if (!ring) {
    return { quotedEach: null, pickupEach: null };
  }
  const perRing = (perFoot: number) =>
    Math.round(perFoot * ring.heightFeet * 100) / 100;
  return {
    quotedEach: perRing(meta.quotedUnitPrice),
    pickupEach: perRing(meta.loadUnitPrice.PICKUP),
  };
}

/** JOB ticket on customer pickup: what each line bills picked up against the
 * quoted price, a box to type another price, and the running ticket total. */
export function PickupPricingCard({
  lines,
  selectedLineIds,
  fulfillmentById,
  updateLine,
  markDirty,
}: PickupPricingCardProps) {
  return (
    <SectionCard
      title="Pickup pricing"
      description="Customer pickup — the quote's delivery charges stay off this ticket. A line on its group's standard discount bills at the pickup discount; an awarded price stays as quoted. Type a price to bill a line at something else."
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
          const { quotedEach, pickupEach } = pickupPricesFor(line, meta);
          const qty = Number(line.quantity) || 0;
          const overrideRaw = line.unitPrice?.trim() ?? "";
          const overrideEach =
            overrideRaw && Number.isFinite(Number(overrideRaw))
              ? Number(overrideRaw)
              : null;
          const effectiveEach = overrideEach ?? pickupEach;
          return {
            line,
            label: meta?.displayName ?? line.itemCode,
            itemCode: line.itemCode,
            quotedEach,
            pickupEach,
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
        return (
          <>
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
                            row.pickupEach != null
                              ? row.pickupEach.toFixed(2)
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
                        <span className="mr-3 font-normal text-emerald-700">
                          {formatUsd(savings)} below quoted
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
