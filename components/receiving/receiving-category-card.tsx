import Link from "next/link";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { ReceivingCategoryKey } from "@/lib/receiving-utils";
import {
  formatReceiptDate,
  formatRelativeDeliveryDate,
  receivingCategoryDescriptions,
  receivingCategoryLabels,
  stalenessBadgeVariant,
  stalenessCardAccent,
  getDeliveryStaleness,
} from "@/lib/receiving-utils";

const accentBorderStyles = {
  emerald: "border-emerald-200 bg-emerald-50/30",
  amber: "border-amber-200 bg-amber-50/30",
  rose: "border-rose-200 bg-rose-50/30",
  sky: "border-sky-200 bg-sky-50/30",
};

type CategoryCardProps = {
  category: ReceivingCategoryKey;
  lastReceiptDate: Date | null;
  supplierLabel: string | null;
  totalPieces: number | null;
  lineCount: number | null;
  openPurchaseOrderCount?: number;
  canManage: boolean;
};

export function ReceivingCategoryCard({
  category,
  lastReceiptDate,
  supplierLabel,
  totalPieces,
  lineCount,
  openPurchaseOrderCount = 0,
  canManage,
}: CategoryCardProps) {
  const staleness = getDeliveryStaleness(lastReceiptDate);
  const accent = stalenessCardAccent(staleness);
  const relativeLabel = formatRelativeDeliveryDate(lastReceiptDate);

  return (
    <div
      className={`flex h-full flex-col rounded-xl border p-4 shadow-sm ${accentBorderStyles[accent]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {receivingCategoryLabels[category]}
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            {receivingCategoryDescriptions[category]}
          </p>
        </div>
        <StatusBadge
          label={relativeLabel}
          variant={stalenessBadgeVariant(staleness)}
        />
      </div>

      <div className="mt-4 flex-1">
        {lastReceiptDate ? (
          <>
            <p className="text-lg font-semibold tracking-tight text-slate-900">
              {formatReceiptDate(lastReceiptDate)}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {supplierLabel ?? "No supplier recorded"}
              {totalPieces !== null
                ? ` · ${totalPieces} piece${totalPieces === 1 ? "" : "s"}`
                : ""}
              {lineCount !== null
                ? ` · ${lineCount} line${lineCount === 1 ? "" : "s"}`
                : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            No deliveries recorded yet. Record the first delivery to start tracking.
          </p>
        )}
        {openPurchaseOrderCount > 0 ? (
          <p className="mt-3 text-xs font-medium text-slate-700">
            {openPurchaseOrderCount} open purchase order
            {openPurchaseOrderCount === 1 ? "" : "s"} awaiting delivery
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canManage ? (
          <Link
            href={`/receiving/receive?category=${category}`}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Record delivery
          </Link>
        ) : null}
        <Link
          href={`/inventory/receipts?category=${category}`}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          History
        </Link>
      </div>
    </div>
  );
}
