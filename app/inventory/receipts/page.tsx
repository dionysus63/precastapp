import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { formatCastingPieceRoleLabel } from "@/lib/casting-utils";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function InventoryReceiptsPage() {
  const receipts = await withDatabaseRetry((client) =>
    client.purchaseReceiptEntry.findMany({
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

  return (
    <DashboardShell
      title="Receipt History"
      subtitle="Past casting deliveries received from suppliers."
    >
      <Link
        href="/inventory"
        className="mb-4 inline-block text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Inventory
      </Link>

      <SectionCard title="Purchase Receipts" noPadding>
        {receipts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No receipts recorded yet. Receive castings from{" "}
            <Link href="/inventory/receive" className="underline">
              Receive Castings
            </Link>
            .
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {receipt.receiptDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {receipt.batchLabel ? ` · ${receipt.batchLabel}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {receipt.supplier?.name ?? "No supplier recorded"}
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
