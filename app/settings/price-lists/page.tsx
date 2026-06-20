import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { createPriceListFormAction } from "@/app/settings/actions";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function PriceListsPage() {
  const priceLists = await withDatabaseRetry((prisma) =>
    prisma.priceList.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: { _count: { select: { items: true } } },
    }),
  );

  return (
    <DashboardShell
      title="Price Lists"
      subtitle="Product pricing for quotes and walk-in delivery tickets."
    >
      <Link
        href="/settings"
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Settings
      </Link>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
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
                    <th className="px-4 py-2 font-semibold">Items</th>
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
                      <td className="px-4 py-2">{list._count.items}</td>
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
    </DashboardShell>
  );
}
