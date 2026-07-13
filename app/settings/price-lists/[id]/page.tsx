import { notFound } from "next/navigation";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  deletePriceListItemFormAction,
  upsertPriceListItemFormAction,
} from "@/app/settings/actions";
import { PriceListSettingsForm } from "@/components/settings/price-list-settings-form";
import {
  getMissingProductsForPriceList,
  getPriceListCompleteness,
} from "@/lib/price-list-service";
import { withDatabaseRetry } from "@/lib/prisma";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";
type PriceListDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PriceListDetailPage({
  params,
}: PriceListDetailPageProps) {
  const { id } = await params;

  const [priceList, missingProducts, completeness] = await Promise.all([
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
    getMissingProductsForPriceList(id),
    getPriceListCompleteness(id),
  ]);

  if (!priceList) {
    notFound();
  }

  return (
    <SettingsShell
      title={priceList.name}
      subtitle="Manage unit prices for products on this list."
      backHref="/settings/price-lists"
      backLabel="← Back to Price Lists"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {priceList.isDefault ? (
            <StatusBadge label="Default" variant="info" />
          ) : null}
          {completeness.isComplete ? (
            <StatusBadge label="Complete" variant="success" />
          ) : (
            <StatusBadge
              label={`${completeness.missingCount} product(s) missing`}
              variant="warning"
            />
          )}
          <span className="text-xs text-slate-500">
            {completeness.listedCount} of {completeness.totalActiveProducts}{" "}
            active products priced
          </span>
        </div>

        <SectionCard title="List settings">
          <PriceListSettingsForm
            priceList={{
              id: priceList.id,
              name: priceList.name,
              effectiveDate: priceList.effectiveDate
                ? priceList.effectiveDate.toISOString().slice(0, 10)
                : "",
              isDefault: priceList.isDefault,
              notes: priceList.notes ?? "",
            }}
          />
        </SectionCard>

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
                {missingProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.productCode} — {product.name}
                  </option>
                ))}
                {priceList.items.map((item) => (
                  <option key={item.productId} value={item.productId}>
                    {item.product.productCode} — {item.product.name}
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
        </SectionCard>

        {missingProducts.length > 0 ? (
          <SectionCard
            title="Missing products"
            description="Active products without a price on this list."
            noPadding
          >
            <div className={tableFlushWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>Product</th>
                    <th className={tableHeaderCellClassName}>Add price</th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {missingProducts.map((product) => (
                    <tr key={product.id}>
                      <td className={tableCellClassName}>
                        <div className="font-medium">{product.productCode}</div>
                        <div className="text-slate-500">{product.name}</div>
                      </td>
                      <td className={tableCellClassName}>
                        <form
                          action={upsertPriceListItemFormAction}
                          className="flex items-end gap-2"
                        >
                          <input type="hidden" name="priceListId" value={priceList.id} />
                          <input type="hidden" name="productId" value={product.id} />
                          <div>
                            <label
                              htmlFor={`unitPrice-${product.id}`}
                              className="sr-only"
                            >
                              Unit price
                            </label>
                            <input
                              id={`unitPrice-${product.id}`}
                              name="unitPrice"
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              placeholder="0.00"
                              className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                            />
                          </div>
                          <button
                            type="submit"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Add
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        ) : null}

        <SectionCard title="Items on this list" noPadding>
          {priceList.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No items yet.</p>
          ) : (
            <div className={tableFlushWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>Product</th>
                    <th className={tableHeaderCellClassName}>Unit price</th>
                    <th className={tableHeaderCellClassName}>Actions</th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {priceList.items.map((item) => (
                    <tr key={item.id}>
                      <td className={tableCellClassName}>
                        <div className="font-medium">{item.product.productCode}</div>
                        <div className="text-slate-500">{item.product.name}</div>
                      </td>
                      <td className={tableCellClassName}>
                        ${Number(item.unitPrice).toFixed(2)}
                      </td>
                      <td className={tableCellClassName}>
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
    </SettingsShell>
  );
}
