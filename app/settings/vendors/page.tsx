import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SettingsFeedback } from "@/components/settings/settings-form-fields";
import { SettingsShell } from "@/components/settings/settings-shell";
import {
  createVendorFormAction,
  updateVendorFormAction,
} from "@/app/settings/vendors/actions";
import { purchaseOrderPrefix } from "@/lib/purchase-order-number";
import { vendorPartyForPdf } from "@/lib/purchase-order-pdf-data";
import { purchaseOrderCategoryFormOptions } from "@/lib/purchase-order-utils";
import { formatReceivingCategoryLabel } from "@/lib/receiving-utils";
import { withDatabaseRetry } from "@/lib/prisma";

import {
  tableActionButtonClassName,
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";
import { BackButton } from "@/components/dashboard/back-button";
/** Field names and labels of a vendor's address and contact, in form order. */
const vendorContactFields = [
  { name: "address", label: "Street address", wide: true },
  { name: "city", label: "City", wide: false },
  { name: "state", label: "State", wide: false },
  { name: "zip", label: "ZIP", wide: false },
  { name: "phone", label: "Phone", wide: false },
  { name: "contactName", label: "Contact (Attn:)", wide: false },
  { name: "email", label: "Email", wide: false },
] as const;

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
  const labelClass = "text-xs font-medium text-slate-700";
  const fieldRowClass = "flex flex-wrap items-end gap-x-4 gap-y-3";

  return (
    <SettingsShell
      title="Vendors"
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Vendor saved." : null}
      />

      <SectionCard
        title="Vendors"
        noPadding
        action={
          // The form is under the list, out of sight on a long one.
          <a
            href="#add-vendor"
            className="rounded-md btn-plain px-3 py-1 text-xs font-semibold"
          >
            Add vendor
          </a>
        }
      >
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
                  <th className={tableHeaderCellClassName}>PO letters</th>
                  <th className={tableHeaderCellClassName}>Address and contact</th>
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
                    <td className={`${tableCellClassName} whitespace-nowrap tabular-nums text-slate-700`}>
                      {purchaseOrderPrefix(vendor.name)}
                    </td>
                    <td className={`${tableCellClassName} text-slate-700`}>
                      {vendorPartyForPdf(vendor, vendor.contactName).lines.length > 0
                        ? vendorPartyForPdf(vendor, vendor.contactName).lines.map((line) => (
                            <span key={line} className="block">
                              {line}
                            </span>
                          ))
                        : "—"}
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
                        <summary className={tableActionButtonClassName}>
                          Edit
                        </summary>
                        <form
                          action={updateVendorFormAction}
                          className="mt-3 grid min-w-[280px] gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                        >
                          <input type="hidden" name="id" value={vendor.id} />
                          <div>
                            <label className="text-2xs font-medium text-slate-600">
                              Name
                            </label>
                            <input
                              name="name"
                              defaultValue={vendor.name}
                              required
                              className={inputClass}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {vendorContactFields.map((field) => (
                              <div
                                key={field.name}
                                className={field.wide ? "col-span-2" : ""}
                              >
                                <label className="text-2xs font-medium text-slate-600">
                                  {field.label}
                                </label>
                                <input
                                  name={field.name}
                                  defaultValue={vendor[field.name] ?? ""}
                                  className={inputClass}
                                />
                              </div>
                            ))}
                          </div>
                          <div>
                            <label className="text-2xs font-medium text-slate-600">
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
                              <label className="text-2xs font-medium text-slate-600">
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
                              <label className="text-2xs font-medium text-slate-600">
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
                            <label className="text-2xs font-medium text-slate-600">
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
                            className="rounded-lg btn-main px-3 py-1.5 text-xs font-semibold"
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

      {/* Everything at the left with the width of what goes in it, the address
          right under the name: it prints on the purchase order. */}
      <div id="add-vendor" className="scroll-mt-24">
        <SectionCard title="Add vendor">
          <form action={createVendorFormAction} className="space-y-3">
            <div className={fieldRowClass}>
              <div className="w-80 max-w-full">
                <label htmlFor="name" className={labelClass}>
                  Name *
                </label>
                <input id="name" name="name" required className={inputClass} />
              </div>
            </div>
            <div className={fieldRowClass}>
              <div className="w-96 max-w-full">
                <label htmlFor="new-vendor-address" className={labelClass}>
                  Street address
                </label>
                <input id="new-vendor-address" name="address" className={inputClass} />
              </div>
              <div className="w-56 max-w-full">
                <label htmlFor="new-vendor-city" className={labelClass}>
                  City
                </label>
                <input id="new-vendor-city" name="city" className={inputClass} />
              </div>
              <div className="w-20">
                <label htmlFor="new-vendor-state" className={labelClass}>
                  State
                </label>
                <input id="new-vendor-state" name="state" className={inputClass} />
              </div>
              <div className="w-28">
                <label htmlFor="new-vendor-zip" className={labelClass}>
                  ZIP
                </label>
                <input id="new-vendor-zip" name="zip" className={inputClass} />
              </div>
            </div>
            <div className={fieldRowClass}>
              <div className="w-48 max-w-full">
                <label htmlFor="new-vendor-phone" className={labelClass}>
                  Phone
                </label>
                <input id="new-vendor-phone" name="phone" className={inputClass} />
              </div>
              <div className="w-56 max-w-full">
                <label htmlFor="new-vendor-contactName" className={labelClass}>
                  Contact (Attn:)
                </label>
                <input
                  id="new-vendor-contactName"
                  name="contactName"
                  className={inputClass}
                />
              </div>
              <div className="w-72 max-w-full">
                <label htmlFor="new-vendor-email" className={labelClass}>
                  Email
                </label>
                <input id="new-vendor-email" name="email" className={inputClass} />
              </div>
            </div>
            <div className={fieldRowClass}>
              <div className="w-56 max-w-full">
                <label htmlFor="defaultCategory" className={labelClass}>
                  Default category
                </label>
                <select
                  id="defaultCategory"
                  name="defaultCategory"
                  className={inputClass}
                >
                  {purchaseOrderCategoryFormOptions.map((option) => (
                    <option key={option.value || "one-off"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label htmlFor="sortOrder" className={labelClass}>
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
            </div>
            <div className="max-w-2xl">
              <label htmlFor="notes" className={labelClass}>
                Notes
              </label>
              <textarea id="notes" name="notes" rows={2} className={inputClass} />
            </div>
            <button
              type="submit"
              className="rounded-lg btn-main px-4 py-2 text-xs font-semibold"
            >
              Add Vendor
            </button>
          </form>
        </SectionCard>
      </div>

      <BackButton href="/settings" label="Back to Settings" />
    </SettingsShell>
  );
}
