import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ReceivingCategoryCard } from "@/components/receiving/receiving-category-card";
import { AppPermission } from "@/app/generated/prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { formatCastingPieceRoleLabel } from "@/lib/casting-utils";
import {
  formatReceiptDate,
  formatReceivingCategoryLabel,
  formatReceivingCategoryShortLabel,
  RECEIVING_CATEGORIES,
  sumReceiptLineQuantities,
  type ReceivingCategoryKey,
} from "@/lib/receiving-utils";
import { OPEN_PURCHASE_ORDER_STATUSES } from "@/lib/purchase-order-utils";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function ReceivingPage() {
  const user = await getCurrentUser();
  const canManage = user
    ? await hasPermission(user, AppPermission.INVENTORY_MANAGE)
    : false;

  const [latestByCategory, openPoCounts, recentReceipts] = await withDatabaseRetry(
    (client) =>
      Promise.all([
        Promise.all(
          RECEIVING_CATEGORIES.map(async (category) => {
            const receipt = await client.purchaseReceiptEntry.findFirst({
              where: { category },
              orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
              include: {
                supplier: { select: { name: true } },
                lines: { select: { quantityReceived: true } },
              },
            });
            return { category, receipt };
          }),
        ),
        Promise.all(
          RECEIVING_CATEGORIES.map(async (category) => {
            const count = await client.purchaseOrder.count({
              where: {
                category,
                status: { in: OPEN_PURCHASE_ORDER_STATUSES },
              },
            });
            return { category, count };
          }),
        ),
        client.purchaseReceiptEntry.findMany({
          orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
          take: 15,
          include: {
            supplier: { select: { name: true } },
            purchaseOrder: { select: { id: true, poNumber: true } },
            lines: {
              include: {
                product: {
                  select: {
                    productCode: true,
                    name: true,
                    castingPieceRole: true,
                    castingSoldAsUnit: true,
                  },
                },
              },
            },
          },
        }),
      ]),
  );

  const openPoCountByCategory = new Map(
    openPoCounts.map((entry) => [entry.category, entry.count]),
  );

  const categoryCards = latestByCategory.map(({ category, receipt }) => ({
    category: category as ReceivingCategoryKey,
    lastReceiptDate: receipt?.receiptDate ?? null,
    supplierLabel:
      receipt?.supplier?.name ?? receipt?.batchLabel ?? receipt?.notes ?? null,
    totalPieces: receipt ? sumReceiptLineQuantities(receipt.lines) : null,
    lineCount: receipt?.lines.length ?? null,
    openPurchaseOrderCount: openPoCountByCategory.get(category) ?? 0,
  }));

  return (
    <DashboardShell
      title="Receiving"
      subtitle="Track when deliveries arrive and record new inventory."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {categoryCards.map((card) => (
          <ReceivingCategoryCard
            key={card.category}
            category={card.category}
            lastReceiptDate={card.lastReceiptDate}
            supplierLabel={card.supplierLabel}
            totalPieces={card.totalPieces}
            lineCount={card.lineCount}
            openPurchaseOrderCount={card.openPurchaseOrderCount}
            canManage={canManage}
          />
        ))}
      </div>

      <SectionCard title="Recent deliveries" noPadding>
        {recentReceipts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No deliveries recorded yet.
            {canManage ? (
              <>
                {" "}
                Use a category card above to record your first delivery.
              </>
            ) : null}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentReceipts.map((receipt) => {
              const totalPieces = sumReceiptLineQuantities(receipt.lines);
              return (
                <div key={receipt.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatReceiptDate(receipt.receiptDate)}
                        </p>
                        <StatusBadge
                          label={formatReceivingCategoryShortLabel(receipt.category)}
                          variant="info"
                        />
                        {receipt.purchaseOrder ? (
                          <Link href={`/purchase-orders/${receipt.purchaseOrder.id}`}>
                            <StatusBadge
                              label={receipt.purchaseOrder.poNumber}
                              variant="neutral"
                            />
                          </Link>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {formatReceivingCategoryLabel(receipt.category)}
                        {receipt.supplier?.name
                          ? ` · ${receipt.supplier.name}`
                          : receipt.batchLabel
                            ? ` · ${receipt.batchLabel}`
                            : ""}
                        {receipt.enteredBy ? ` · Received by ${receipt.enteredBy}` : ""}
                      </p>
                      {receipt.notes ? (
                        <p className="mt-1 text-xs text-slate-500">{receipt.notes}</p>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      {totalPieces} piece{totalPieces === 1 ? "" : "s"} ·{" "}
                      {receipt.lines.length} line{receipt.lines.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-slate-700">
                    {receipt.lines.map((line) => (
                      <li key={line.id}>
                        {Number(line.quantityReceived)} × {line.product.productCode} —{" "}
                        {line.product.name}
                        {line.product.castingPieceRole
                          ? ` (${formatCastingPieceRoleLabel(line.product.castingPieceRole)})`
                          : line.product.castingSoldAsUnit
                            ? " (one-piece unit)"
                            : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <Link
          href="/inventory/receipts"
          className="font-medium text-slate-700 underline hover:text-slate-900"
        >
          View full receipt history
        </Link>
        <Link
          href="/purchase-orders"
          className="font-medium text-slate-700 underline hover:text-slate-900"
        >
          Purchase orders
        </Link>
        <Link
          href="/inventory"
          className="font-medium text-slate-500 hover:text-slate-900"
        >
          Go to inventory
        </Link>
      </div>
    </DashboardShell>
  );
}
