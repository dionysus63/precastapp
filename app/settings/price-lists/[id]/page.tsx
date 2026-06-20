import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  deletePriceListItemFormAction,
  upsertPriceListItemFormAction,
} from "@/app/settings/actions";
import { withDatabaseRetry } from "@/lib/prisma";

type PriceListDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PriceListDetailPage({
  params,
}: PriceListDetailPageProps) {
  const { id } = await params;

  const [priceList, products] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.priceList.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { product: { productCode: "asc" } },
            include: {
              product: {
                select: { productCode: true, name: true },
              },
            },
          },
        },
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        orderBy: { productCode: "asc" },
        select: { id: true, productCode: true, name: true },
      }),
    ),
  ]);

  if (!priceList) {
    notFound();
  }

  const listedProductIds = new Set(priceList.items.map((item) => item.productId));

  return (
    <DashboardShell
      title={priceList.name}
      subtitle="Manage unit prices for products on this list."
    >
      <Link
        href="/settings/price-lists"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Price Lists
      </Link>

      <div className="mt-4 space-y-4">
        <SectionCard title="Add or update item">
          <form action={upsertPriceListItemFormAction} className="grid max-w-lg gap-3 sm:grid-cols-3">
            <input type="hidden" name="priceListId" value={priceList.id} />
            <div className="sm:col-span-2">
              <label htmlFor="productId" className="text-xs font-medium text-slate-700">
                Product
              </label>
              <select
                id="productId"
                name="productId"
                required
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="">Select product…</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.productCode} — {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="unitPrice" className="text-xs font-medium text-slate-700">
                Unit price
              </label>
              <input
                id="unitPrice"
                name="unitPrice"
                type="number"
                min="0"
                step="0.01"
                required
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white"
              >
                Save item
              </button>
            </div>
          </form>
          {products.some((p) => !listedProductIds.has(p.id)) ? (
            <p className="mt-2 text-[11px] text-slate-500">
              {products.length - listedProductIds.size} active product(s) not yet on this list.
            </p>
          ) : null}
        </SectionCard>

        <SectionCard title="Items on this list" noPadding>
          {priceList.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No items yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Product</th>
                    <th className="px-4 py-2 font-semibold">Unit price</th>
                    <th className="px-4 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {priceList.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{item.product.productCode}</div>
                        <div className="text-slate-500">{item.product.name}</div>
                      </td>
                      <td className="px-4 py-2">
                        ${Number(item.unitPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        <form action={deletePriceListItemFormAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="priceListId" value={priceList.id} />
                          <button
                            type="submit"
                            className="text-red-700 underline hover:text-red-900"
                          >
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
