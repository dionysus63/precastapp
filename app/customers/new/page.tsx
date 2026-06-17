import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";

const customerTypes = ["Commercial", "Residential", "Contractor", "Other"];
const statusOptions = ["Active", "Inactive", "Prospect"];

const inputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export default function NewCustomerPage() {
  return (
    <DashboardShell
      title="New Customer"
      subtitle="Create a customer record for quotes, jobs, and invoicing."
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href="/customers"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Customers
        </Link>

        <SectionCard
          title="Customer Details"
          description="Static preview form — saving is not connected yet."
        >
          <form className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-medium text-slate-700"
              >
                Customer Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className={inputClassName}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="customerType"
                  className="block text-xs font-medium text-slate-700"
                >
                  Customer Type
                </label>
                <select
                  id="customerType"
                  name="customerType"
                  defaultValue="Commercial"
                  className={inputClassName}
                >
                  {customerTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="status"
                  className="block text-xs font-medium text-slate-700"
                >
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue="Active"
                  className={inputClassName}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="primaryContact"
                className="block text-xs font-medium text-slate-700"
              >
                Primary Contact Name
              </label>
              <input
                id="primaryContact"
                name="primaryContact"
                type="text"
                className={inputClassName}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="phone"
                  className="block text-xs font-medium text-slate-700"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className={inputClassName}
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-slate-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={inputClassName}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="billingAddress"
                className="block text-xs font-medium text-slate-700"
              >
                Billing Address
              </label>
              <textarea
                id="billingAddress"
                name="billingAddress"
                rows={3}
                className={inputClassName}
              />
            </div>

            <div>
              <label
                htmlFor="notes"
                className="block text-xs font-medium text-slate-700"
              >
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                className={inputClassName}
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
              <Link
                href="/customers"
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Save Customer
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
