import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { InventorySubmittalsCell } from "@/components/inventory/inventory-submittals-cell";
import { SectionCard } from "@/components/dashboard/section-card";
import { PRODUCT_SUBMITTAL_DOCUMENT_TYPES } from "@/lib/product-submittals-service";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function InventoryPage() {
  const products = await withDatabaseRetry((prisma) =>
    prisma.product.findMany({
      where: { trackInventory: true, status: "ACTIVE" },
      orderBy: { productCode: "asc" },
      select: {
        id: true,
        productCode: true,
        name: true,
        currentStockQuantity: true,
        reorderLevel: true,
        yardLocation: true,
        unit: true,
        _count: {
          select: {
            documents: {
              where: {
                documentType: { in: PRODUCT_SUBMITTAL_DOCUMENT_TYPES },
              },
            },
          },
        },
      },
    }),
  );

  return (
    <DashboardShell
      title="Inventory"
      subtitle="Stock levels for products tracked in the yard."
    >
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Link
          href="/inventory/receive"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Receive Castings
        </Link>
        <Link
          href="/inventory/adjust"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Adjust Stock
        </Link>
        <Link
          href="/inventory/production"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Daily Production Entry
        </Link>
      </div>

      <SectionCard title="Current Stock" noPadding>
        {products.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No inventory-tracked products.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 font-semibold">Code</th>
                  <th className="px-4 py-2 font-semibold">Product</th>
                  <th className="px-4 py-2 font-semibold">On Hand</th>
                  <th className="px-4 py-2 font-semibold">Reorder</th>
                  <th className="px-4 py-2 font-semibold">Yard</th>
                  <th className="px-4 py-2 font-semibold">Submittals</th>
                  <th className="px-4 py-2 font-semibold">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => {
                  const low =
                    product.reorderLevel > 0 &&
                    product.currentStockQuantity <= product.reorderLevel;
                  return (
                    <tr key={product.id} className="text-slate-800 hover:bg-slate-50/60">
                      <td className="px-4 py-2 font-medium">
                        <Link
                          href={`/inventory/${product.id}`}
                          className="text-slate-900 hover:text-slate-700"
                        >
                          {product.productCode}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{product.name}</td>
                      <td
                        className={`px-4 py-2 ${low ? "font-semibold text-amber-700" : ""}`}
                      >
                        {product.currentStockQuantity} {product.unit}
                      </td>
                      <td className="px-4 py-2">{product.reorderLevel}</td>
                      <td className="px-4 py-2">{product.yardLocation ?? "—"}</td>
                      <td className="px-4 py-2">
                        <InventorySubmittalsCell
                          productId={product.id}
                          submittalCount={product._count.documents}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/inventory/${product.id}`}
                          className="text-slate-700 underline hover:text-slate-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </DashboardShell>
  );
}
