import Link from "next/link";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { createPriceListFormAction } from "@/app/settings/actions";
import { getPriceListCompleteness } from "@/lib/price-list-service";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function PriceListsPage() {
  const priceLists = await withDatabaseRetry(async (prisma) => {
    const lists = await prisma.priceList.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: { _count: { select: { items: true } } },
    });

    return Promise.all(
      lists.map(async (list) => ({
        ...list,
        completeness: await getPriceListCompleteness(list.id, prisma),
      })),
    );
  });

  return (
    <SettingsShell
      title="Price Lists"
      subtitle="Product pricing for quotes and walk-in delivery tickets."
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard title="Price lists" noPadding>
          {priceLists.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">No price lists yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Name</th>
                    <th className="px-4 py-2 font-semibold">Effective</th>
                    <th className="px-4 py-2 font-semibold">Coverage</th>
                    <th className="px-4 py-2 font-semibold">Default</th>
                    <th className="px-4 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {priceLists.map((list) => (
                    <tr key={list.id}>
                      <td className="px-4 py-2 font-medium">{list.name}</td>
                      <td className="px-4 py-2">
                        {list.effectiveDate
                          ? new Date(list.effectiveDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            {list.completeness.listedCount}/
                            {list.completeness.totalActiveProducts}
                          </span>
                          {list.completeness.isComplete ? (
                            <StatusBadge label="Complete" variant="success" />
                          ) : (
                            <StatusBadge
                              label={`${list.completeness.missingCount} missing`}
                              variant="warning"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {list.isDefault ? (
                          <StatusBadge label="Default" variant="success" />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/settings/price-lists/${list.id}`}
                          className="text-slate-700 underline hover:text-slate-900"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="New price list">
          <form action={createPriceListFormAction} className="grid gap-3">
            <div>
              <label htmlFor="name" className="text-xs font-medium text-slate-700">
                Name
              </label>
              <input
                id="name"
                name="name"
                required
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label
                htmlFor="copyFromPriceListId"
                className="text-xs font-medium text-slate-700"
              >
                Copy prices from
              </label>
              <select
                id="copyFromPriceListId"
                name="copyFromPriceListId"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="">Start empty</option>
                {priceLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Copy an existing list when issuing a new price list, then adjust
                individual prices.
              </p>
            </div>
            <div>
              <label
                htmlFor="effectiveDate"
                className="text-xs font-medium text-slate-700"
              >
                Effective date
              </label>
              <input
                id="effectiveDate"
                name="effectiveDate"
                type="date"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="isDefault" />
              Set as default
            </label>
            <p className="text-[11px] text-slate-500">
              A list must include every active product before it can be set as
              default.
            </p>
            <div>
              <label htmlFor="notes" className="text-xs font-medium text-slate-700">
                Notes
              </label>
              <input
                id="notes"
                name="notes"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white"
            >
              Create
            </button>
          </form>
        </SectionCard>
      </div>
    </SettingsShell>
  );
}
