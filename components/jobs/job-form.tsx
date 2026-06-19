import Link from "next/link";
import {
  jobInputClassName,
  jobStatusFormOptions,
} from "@/components/jobs/job-utils";

export type JobCustomerOption = {
  id: string;
  name: string;
};

export type JobFormValues = {
  id?: string;
  jobNumber?: string;
  jobYear?: number;
  customerId?: string;
  customerName?: string;
  projectName?: string;
  projectAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  status?: string;
  bidDate?: string;
  awardedDate?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
};

type JobFormProps = {
  action: (formData: FormData) => Promise<void>;
  customers: JobCustomerOption[];
  defaultJobYear: number;
  submitLabel?: string;
  cancelHref?: string;
  defaultValues?: JobFormValues;
};

export function JobForm({
  action,
  customers,
  defaultJobYear,
  submitLabel = "Create Job",
  cancelHref = "/jobs",
  defaultValues,
}: JobFormProps) {
  const isEdit = Boolean(defaultValues?.id);

  return (
    <form action={action} className="space-y-5">
      {defaultValues?.id ? (
        <input type="hidden" name="id" value={defaultValues.id} />
      ) : null}

      {isEdit ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Job Number
            </p>
            <p className="mt-1 font-mono text-sm text-slate-900">
              {defaultValues?.jobNumber}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Job Year
            </p>
            <p className="mt-1 text-sm text-slate-900">{defaultValues?.jobYear}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="customerId"
            className="block text-xs font-medium text-slate-700"
          >
            Customer
          </label>
          <select
            id="customerId"
            name="customerId"
            defaultValue={defaultValues?.customerId ?? ""}
            className={jobInputClassName}
          >
            <option value="">Select customer (optional)</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="customerName"
            className="block text-xs font-medium text-slate-700"
          >
            Customer Name
          </label>
          <input
            id="customerName"
            name="customerName"
            type="text"
            defaultValue={defaultValues?.customerName ?? ""}
            placeholder="One-off customer name"
            className={jobInputClassName}
          />
          <p className="mt-2 text-xs text-slate-500">
            Select a customer above, or enter a name here for one-off customers.
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="projectName"
          className="block text-xs font-medium text-slate-700"
        >
          Project Name *
        </label>
        <input
          id="projectName"
          name="projectName"
          type="text"
          required
          defaultValue={defaultValues?.projectName ?? ""}
          placeholder="Main Street Drainage"
          className={jobInputClassName}
        />
      </div>

      <div>
        <label
          htmlFor="projectAddress"
          className="block text-xs font-medium text-slate-700"
        >
          Project Address
        </label>
        <input
          id="projectAddress"
          name="projectAddress"
          type="text"
          defaultValue={defaultValues?.projectAddress ?? ""}
          placeholder="120 Main Street"
          className={jobInputClassName}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label
            htmlFor="city"
            className="block text-xs font-medium text-slate-700"
          >
            City
          </label>
          <input
            id="city"
            name="city"
            type="text"
            defaultValue={defaultValues?.city ?? ""}
            placeholder="Riverhead"
            className={jobInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="state"
            className="block text-xs font-medium text-slate-700"
          >
            State
          </label>
          <input
            id="state"
            name="state"
            type="text"
            defaultValue={defaultValues?.state ?? ""}
            placeholder="NY"
            maxLength={2}
            className={jobInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="zip"
            className="block text-xs font-medium text-slate-700"
          >
            ZIP
          </label>
          <input
            id="zip"
            name="zip"
            type="text"
            defaultValue={defaultValues?.zip ?? ""}
            placeholder="11901"
            className={jobInputClassName}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {!isEdit ? (
          <div>
            <label
              htmlFor="jobYear"
              className="block text-xs font-medium text-slate-700"
            >
              Job Year *
            </label>
            <input
              id="jobYear"
              name="jobYear"
              type="number"
              required
              min="2000"
              max="2099"
              defaultValue={defaultValues?.jobYear ?? defaultJobYear}
              className={jobInputClassName}
            />
            <p className="mt-2 text-xs text-slate-500">
              The job number will be assigned automatically, such as 26-001.
            </p>
          </div>
        ) : null}

        <div className={isEdit ? "sm:col-span-2" : undefined}>
          <label
            htmlFor="status"
            className="block text-xs font-medium text-slate-700"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaultValues?.status ?? "QUOTING"}
            className={jobInputClassName}
          >
            {jobStatusFormOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="bidDate"
            className="block text-xs font-medium text-slate-700"
          >
            Bid Date
          </label>
          <input
            id="bidDate"
            name="bidDate"
            type="date"
            defaultValue={defaultValues?.bidDate ?? ""}
            className={jobInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="awardedDate"
            className="block text-xs font-medium text-slate-700"
          >
            Awarded Date
          </label>
          <input
            id="awardedDate"
            name="awardedDate"
            type="date"
            defaultValue={defaultValues?.awardedDate ?? ""}
            className={jobInputClassName}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label
            htmlFor="contactName"
            className="block text-xs font-medium text-slate-700"
          >
            Contact Name
          </label>
          <input
            id="contactName"
            name="contactName"
            type="text"
            defaultValue={defaultValues?.contactName ?? ""}
            placeholder="Jane Smith"
            className={jobInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="contactEmail"
            className="block text-xs font-medium text-slate-700"
          >
            Contact Email
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={defaultValues?.contactEmail ?? ""}
            placeholder="jane@example.com"
            className={jobInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="contactPhone"
            className="block text-xs font-medium text-slate-700"
          >
            Contact Phone
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            defaultValue={defaultValues?.contactPhone ?? ""}
            placeholder="(631) 555-0100"
            className={jobInputClassName}
          />
        </div>
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
          placeholder="Scope notes, bid assumptions, or scheduling details..."
          className={jobInputClassName}
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
