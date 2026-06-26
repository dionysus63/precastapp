import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SettingsFeedback } from "@/components/settings/settings-form-fields";
import { SettingsShell } from "@/components/settings/settings-shell";
import {
  createCastingSupplierFormAction,
  updateCastingSupplierFormAction,
} from "@/app/settings/casting-suppliers/actions";
import {
  castingSupplierOriginFormOptions,
  formatCastingSupplierOriginLabel,
} from "@/lib/casting-utils";
import { withDatabaseRetry } from "@/lib/prisma";

type CastingSuppliersPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function CastingSuppliersPage({
  searchParams,
}: CastingSuppliersPageProps) {
  const params = await searchParams;
  const suppliers = await withDatabaseRetry((client) =>
    client.castingSupplier.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    }),
  );

  const inputClass =
    "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

  return (
    <SettingsShell
      title="Casting Suppliers"
      subtitle="Domestic and imported vendors for cast iron castings."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Supplier saved." : null}
      />

      <SectionCard title="Suppliers" noPadding>
        {suppliers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No suppliers yet. Add your domestic and imported vendors below.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Origin</th>
                  <th className="px-4 py-2.5 font-semibold">Products</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Sort</th>
                  <th className="px-4 py-2.5 font-semibold">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {supplier.name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {formatCastingSupplierOriginLabel(supplier.origin)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {supplier._count.products}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={supplier.status === "ACTIVE" ? "Active" : "Inactive"}
                        variant={
                          supplier.status === "ACTIVE" ? "success" : "neutral"
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {supplier.sortOrder}
                    </td>
                    <td className="px-4 py-2.5">
                      <details>
                        <summary className="cursor-pointer text-slate-700 underline hover:text-slate-900">
                          Edit
                        </summary>
                        <form
                          action={updateCastingSupplierFormAction}
                          className="mt-3 grid min-w-[280px] gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                        >
                          <input type="hidden" name="id" value={supplier.id} />
                          <div>
                            <label className="text-[11px] font-medium text-slate-600">
                              Name
                            </label>
                            <input
                              name="name"
                              defaultValue={supplier.name}
                              required
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-slate-600">
                              Origin
                            </label>
                            <select
                              name="origin"
                              defaultValue={supplier.origin}
                              className={inputClass}
                            >
                              {castingSupplierOriginFormOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[11px] font-medium text-slate-600">
                                Status
                              </label>
                              <select
                                name="status"
                                defaultValue={supplier.status}
                                className={inputClass}
                              >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-slate-600">
                                Sort
                              </label>
                              <input
                                name="sortOrder"
                                type="number"
                                defaultValue={supplier.sortOrder}
                                className={inputClass}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-slate-600">
                              Notes
                            </label>
                            <textarea
                              name="notes"
                              rows={2}
                              defaultValue={supplier.notes ?? ""}
                              className={inputClass}
                            />
                          </div>
                          <button
                            type="submit"
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            Save
                          </button>
                        </form>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Add supplier">
        <form action={createCastingSupplierFormAction} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="text-xs font-medium text-slate-700">
              Name *
            </label>
            <input id="name" name="name" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="origin" className="text-xs font-medium text-slate-700">
              Origin *
            </label>
            <select id="origin" name="origin" required className={inputClass}>
              {castingSupplierOriginFormOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sortOrder" className="text-xs font-medium text-slate-700">
              Sort order
            </label>
            <input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue="0"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className="text-xs font-medium text-slate-700">
              Notes
            </label>
            <textarea id="notes" name="notes" rows={2} className={inputClass} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Add Supplier
            </button>
          </div>
        </form>
      </SectionCard>

      <Link
        href="/settings"
        className="inline-block text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Settings
      </Link>
    </SettingsShell>
  );
}
