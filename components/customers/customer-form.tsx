import Link from "next/link";
import {
  customerStatusFormOptions,
  customerTypeFormOptions,
} from "@/components/customers/customer-utils";

export type CustomerFormValues = {
  id?: string;
  name: string;
  customerType: string;
  status: string;
  primaryContactName: string;
  phone: string;
  email: string;
  billingAddress: string;
  notes: string;
};

type CustomerFormProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  submitLabel: string;
  defaultValues?: CustomerFormValues;
};

export const customerInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export function CustomerForm({
  action,
  cancelHref,
  submitLabel,
  defaultValues,
}: CustomerFormProps) {
  return (
    <form action={action} className="space-y-5">
      {defaultValues?.id ? (
        <input type="hidden" name="id" value={defaultValues.id} />
      ) : null}

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
          defaultValue={defaultValues?.name ?? ""}
          className={customerInputClassName}
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
            defaultValue={defaultValues?.customerType ?? "CONTRACTOR"}
            className={customerInputClassName}
          >
            {customerTypeFormOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
            defaultValue={defaultValues?.status ?? "ACTIVE"}
            className={customerInputClassName}
          >
            {customerStatusFormOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="primaryContactName"
          className="block text-xs font-medium text-slate-700"
        >
          Primary Contact Name
        </label>
        <input
          id="primaryContactName"
          name="primaryContactName"
          type="text"
          defaultValue={defaultValues?.primaryContactName ?? ""}
          className={customerInputClassName}
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
            defaultValue={defaultValues?.phone ?? ""}
            className={customerInputClassName}
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
            defaultValue={defaultValues?.email ?? ""}
            className={customerInputClassName}
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
          defaultValue={defaultValues?.billingAddress ?? ""}
          className={customerInputClassName}
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
          defaultValue={defaultValues?.notes ?? ""}
          className={customerInputClassName}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
        <Link
          href={cancelHref}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
