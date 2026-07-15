import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatCastingPieceRoleLabel } from "@/lib/casting-utils";
import { parseStringParam, type RawSearchParams } from "@/lib/list-params";
import {
  formatReceivingCategoryLabel,
  formatReceivingCategoryShortLabel,
  parseReceivingCategory,
  RECEIVING_CATEGORIES,
} from "@/lib/receiving-utils";
import { withDatabaseRetry } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

import { BackButton } from "@/components/dashboard/back-button";
type InventoryReceiptsPageProps = {
  searchParams: Promise<RawSearchParams>;
};

export default async function InventoryReceiptsPage({
  searchParams,
}: InventoryReceiptsPageProps) {
  const params = await searchParams;
  const categoryParam = parseStringParam(params.category);
  const categoryFilter = categoryParam
    ? parseReceivingCategory(categoryParam)
    : null;

  const where: Prisma.PurchaseReceiptEntryWhereInput = categoryFilter
    ? { category: categoryFilter }
    : {};

  const receipts = await withDatabaseRetry((client) =>
    client.purchaseReceiptEntry.findMany({
      where,
      orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        supplier: { select: { name: true, origin: true } },
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
  );

  function filterHref(nextCategory: string | null) {
    if (!nextCategory) {
      return "/inventory/receipts";
    }
    return `/inventory/receipts?category=${nextCategory}`;
  }

  return (
    <DashboardShell
      title="Receipt History"
      subtitle="Past deliveries received from suppliers."
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <BackButton href="/receiving" label="Back to Receiving" />
        <Link
          href="/inventory"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          Inventory
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link
          href={filterHref(null)}
          className={`rounded-lg border px-3 py-2 ${
            !categoryFilter
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          All
        </Link>
        {RECEIVING_CATEGORIES.map((category) => (
          <Link
            key={category}
            href={filterHref(category)}
            className={`rounded-lg border px-3 py-2 ${
              categoryFilter === category
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {formatReceivingCategoryShortLabel(category)}
          </Link>
        ))}
      </div>

      <SectionCard
        title={
          categoryFilter
            ? `${formatReceivingCategoryLabel(categoryFilter)} receipts`
            : "Purchase Receipts"
        }
        noPadding
      >
        {receipts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No receipts recorded yet.
            {categoryFilter ? (
              <>
                {" "}
                Record a delivery from{" "}
                <Link
                  href={`/receiving/receive?category=${categoryFilter}`}
                  className="underline"
                >
                  Receiving
                </Link>
                .
              </>
            ) : (
              <>
                {" "}
                Receive products from{" "}
                <Link href="/receiving" className="underline">
                  Receiving
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {receipt.receiptDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {receipt.batchLabel ? ` · ${receipt.batchLabel}` : ""}
                      </p>
                      <StatusBadge
                        label={formatReceivingCategoryShortLabel(receipt.category)}
                        variant="info"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {formatReceivingCategoryLabel(receipt.category)}
                      {receipt.supplier?.name
                        ? ` · ${receipt.supplier.name}`
                        : ""}
                      {receipt.enteredBy ? ` · Received by ${receipt.enteredBy}` : ""}
                    </p>
                    {receipt.notes ? (
                      <p className="mt-1 text-xs text-slate-500">{receipt.notes}</p>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">
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
            ))}
          </div>
        )}
      </SectionCard>
    </DashboardShell>
  );
}
