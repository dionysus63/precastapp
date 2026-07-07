import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SettingsFeedback } from "@/components/settings/settings-form-fields";
import { SettingsShell } from "@/components/settings/settings-shell";
import {
  createVendorFormAction,
  updateVendorFormAction,
} from "@/app/settings/vendors/actions";
import { purchaseOrderCategoryFormOptions } from "@/lib/purchase-order-utils";
import { formatReceivingCategoryLabel } from "@/lib/receiving-utils";
import { withDatabaseRetry } from "@/lib/prisma";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";
type VendorsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function VendorsPage({ searchParams }: VendorsPageProps) {
  const params = await searchParams;
  const vendors = await withDatabaseRetry((client) =>
    client.vendor.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { purchaseOrders: true } } },
    }),
  );

  const inputClass =
    "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

  return (
    <SettingsShell
      title="Vendors"
      subtitle="Suppliers for purchase orders and accounts payable."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Vendor saved." : null}
      />

      <SectionCard title="Vendors" noPadding>
        {vendors.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No vendors yet. Add your pipe, casting, and one-off suppliers below.
          </p>
        ) : (
          <div className={tableFlushWrapperClassName}>
            <table className={tableClassName}>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>Name</th>
                  <th className={tableHeaderCellClassName}>Default category</th>
                  <th className={tableHeaderCellClassName}>POs</th>
                  <th className={tableHeaderCellClassName}>Status</th>
                  <th className={tableHeaderCellClassName}>Sort</th>
                  <th className={tableHeaderCellClassName}>Edit</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className={tableRowClassName}>
                    <td className={`${tableCellClassName} font-medium text-slate-900`}>
                      {vendor.name}
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      {vendor.defaultCategory
                        ? formatReceivingCategoryLabel(vendor.defaultCategory)
                        : "One-off"}
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      {vendor._count.purchaseOrders}
                    </td>
                    <td className={tableCellClassName}>
                      <StatusBadge
                        label={vendor.status === "ACTIVE" ? "Active" : "Inactive"}
                        variant={
                          vendor.status === "ACTIVE" ? "success" : "neutral"
                        }
                      />
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      {vendor.sortOrder}
                    </td>
                    <td className={tableCellClassName}>
                      <details>
                        <summary className="cursor-pointer text-slate-700 underline hover:text-slate-900">
                          Edit
                        </summary>
                        <form
                          action={updateVendorFormAction}
                          className="mt-3 grid min-w-[280px] gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                        >
                          <input type="hidden" name="id" value={vendor.id} />
                          <div>
                            <label className="text-[11px] font-medium text-slate-600">
                              Name
                            </label>
                            <input
                              name="name"
                              defaultValue={vendor.name}
                              required
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-slate-600">
                              Default category
                            </label>
                            <select
                              name="defaultCategory"
                              defaultValue={vendor.defaultCategory ?? ""}
                              className={inputClass}
                            >
                              {purchaseOrderCategoryFormOptions.map((option) => (
                                <option
                                  key={option.value || "one-off"}
                                  value={option.value}
                                >
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
                                defaultValue={vendor.status}
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
                                defaultValue={vendor.sortOrder}
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
                              defaultValue={vendor.notes ?? ""}
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

      <SectionCard title="Add vendor">
        <form action={createVendorFormAction} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="text-xs font-medium text-slate-700">
              Name *
            </label>
            <input id="name" name="name" required className={inputClass} />
          </div>
          <div>
            <label
              htmlFor="defaultCategory"
              className="text-xs font-medium text-slate-700"
            >
              Default category
            </label>
            <select id="defaultCategory" name="defaultCategory" className={inputClass}>
              {purchaseOrderCategoryFormOptions.map((option) => (
                <option key={option.value || "one-off"} value={option.value}>
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
              Add Vendor
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
