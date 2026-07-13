"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  clearAllCustomersFormAction,
  clearAllDeliveryTicketsFormAction,
  clearAllJobsFormAction,
  clearAllProductsFormAction,
  clearAllQuotesFormAction,
  clearAllStructuresFormAction,
  setAllTrackedStockFormAction,
  type DataResetStats,
} from "@/app/settings/actions";
import { SettingsFeedback } from "@/components/settings/settings-form-fields";

type DataResetPanelProps = {
  stats: DataResetStats;
};

type DataResetSectionProps = {
  title: string;
  description: ReactNode;
  inputId: string;
  count: number;
  buttonLabel: string;
  disabled: boolean;
  action: (formData: FormData) => Promise<{ error?: string; success?: string }>;
};

function DataResetSection({
  title,
  description,
  inputId,
  count,
  buttonLabel,
  disabled,
  action,
}: DataResetSectionProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{
    error?: string;
    success?: string;
  }>({});
  const [pending, startTransition] = useTransition();

  function handleClear() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("resetPassword", password);
      try {
        const result = await action(formData);
        setMessage(result);
        if (result.success) {
          setPassword("");
          router.refresh();
        }
      } catch {
        setMessage({ error: "An unexpected error occurred. Please try again." });
      }
    });
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
      <h3 className="text-sm font-semibold text-red-900">{title}</h3>
      <p className="mt-2 text-xs text-red-800">{description}</p>
      <div className="mt-4 space-y-3">
        <div>
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-slate-700"
          >
            Reset password
          </label>
          <input
            id={inputId}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={disabled || pending}
            autoComplete="off"
            className="mt-1 w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          disabled={disabled || pending || count === 0}
          onClick={handleClear}
          className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
        >
          {pending ? "Deleting…" : buttonLabel}
        </button>
        <SettingsFeedback error={message.error} success={message.success} />
      </div>
    </div>
  );
}

function TestStockSection({
  trackedProductCount,
  disabled,
}: {
  trackedProductCount: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [stockLevel, setStockLevel] = useState("500");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{
    error?: string;
    success?: string;
  }>({});
  const [pending, startTransition] = useTransition();

  function handleApply() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("resetPassword", password);
      formData.set("stockLevel", stockLevel);
      try {
        const result = await setAllTrackedStockFormAction(formData);
        setMessage(result);
        if (result.success) {
          setPassword("");
          router.refresh();
        }
      } catch {
        setMessage({ error: "An unexpected error occurred. Please try again." });
      }
    });
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <h3 className="text-sm font-semibold text-amber-900">
        Set test stock levels
      </h3>
      <p className="mt-2 text-xs text-amber-800">
        Sets every inventory-tracked product ({trackedProductCount} currently)
        to the stock level below, writing an adjustment to the inventory
        ledger for each change. Meant for testing — real counts are lost, so
        note them first if you need them back.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="test-stock-level"
            className="block text-xs font-medium text-slate-700"
          >
            Stock level
          </label>
          <input
            id="test-stock-level"
            type="number"
            min={0}
            max={1000000}
            step={1}
            value={stockLevel}
            onChange={(event) => setStockLevel(event.target.value)}
            disabled={disabled || pending}
            className="mt-1 w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label
            htmlFor="test-stock-password"
            className="block text-xs font-medium text-slate-700"
          >
            Reset password
          </label>
          <input
            id="test-stock-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={disabled || pending}
            autoComplete="off"
            className="mt-1 w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          disabled={disabled || pending || trackedProductCount === 0}
          onClick={handleApply}
          className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {pending
            ? "Setting…"
            : `Set all tracked products to ${stockLevel || "…"}`}
        </button>
        <SettingsFeedback error={message.error} success={message.success} />
      </div>
    </div>
  );
}

export function DataResetPanel({ stats }: DataResetPanelProps) {
  const actionsDisabled = !stats.resetConfigured;

  return (
    <div className="space-y-6">
      {!stats.resetConfigured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Data reset is disabled until you set{" "}
          <code className="font-mono">SETTINGS_RESET_PASSWORD</code> in{" "}
          <code className="font-mono">.env</code> and restart the app.
        </p>
      ) : null}

      <TestStockSection
        trackedProductCount={stats.trackedProductCount}
        disabled={actionsDisabled}
      />

      <DataResetSection
        title="Clear all products"
        description={
          <>
            Deletes every product ({stats.productCount} currently in the
            database), including catalog documents, price list links, the
            inventory ledger, production entries, and purchase receipts. Quote,
            delivery, and job lines keep their rows but lose product links.
            Product submittal files on disk are not removed.
          </>
        }
        inputId="reset-password-products"
        count={stats.productCount}
        buttonLabel="Delete all products"
        disabled={actionsDisabled}
        action={clearAllProductsFormAction}
      />

      <DataResetSection
        title="Clear all structures & drill sheets"
        description={
          <>
            Deletes every structure ({stats.structureCount} currently in the
            database) with its drill-sheet data — sections, openings, castings,
            dimensions, documents, and shipping pieces. Quote and delivery
            ticket lines keep their rows but lose the structure link. Structure
            templates and the opening catalogs are not touched.
          </>
        }
        inputId="reset-password-structures"
        count={stats.structureCount}
        buttonLabel="Delete all structures"
        disabled={actionsDisabled}
        action={clearAllStructuresFormAction}
      />

      <DataResetSection
        title="Clear all customers"
        description={
          <>
            Deletes every customer ({stats.customerCount} currently in the
            database) and their contacts. Job bid list entries for those
            customers are removed. Jobs, quotes, delivery tickets, and invoices
            remain but no longer reference a customer.
          </>
        }
        inputId="reset-password-customers"
        count={stats.customerCount}
        buttonLabel="Delete all customers"
        disabled={actionsDisabled}
        action={clearAllCustomersFormAction}
      />

      <DataResetSection
        title="Clear all quotes"
        description={
          <>
            Deletes every quote ({stats.quoteCount} currently in the database)
            with its line items. Structures that belong only to a quote (no
            job) are removed with it; job-linked structures survive and lose
            the quote link. Delivery tickets and invoices keep their rows but
            no longer reference a quote. Quote PDFs on disk are not removed.
          </>
        }
        inputId="reset-password-quotes"
        count={stats.quoteCount}
        buttonLabel="Delete all quotes"
        disabled={actionsDisabled}
        action={clearAllQuotesFormAction}
      />

      <DataResetSection
        title="Clear all delivery tickets & invoices"
        description={
          <>
            Deletes every delivery ticket ({stats.deliveryTicketCount} currently
            in the database) with its line items — including the walk-in and
            pickup tickets on the Walk-Ins board — and every invoice (
            {stats.invoiceCount} currently in the database). Ticket and invoice
            numbering sequences are reset. Jobs, quotes, and the inventory
            ledger are not touched.
          </>
        }
        inputId="reset-password-delivery-tickets"
        count={stats.deliveryTicketCount + stats.invoiceCount}
        buttonLabel="Delete all delivery tickets & invoices"
        disabled={actionsDisabled}
        action={clearAllDeliveryTicketsFormAction}
      />

      <DataResetSection
        title="Clear all jobs"
        description={
          <>
            Deletes every job ({stats.jobCount} currently in the database),
            including bid list entries, file records, and favorites. Job
            numbering sequences are reset so the next job of each year starts at
            001. Quotes, job structures, delivery tickets, and invoices remain
            but no longer reference a job. Job folders on disk are not removed.
          </>
        }
        inputId="reset-password-jobs"
        count={stats.jobCount}
        buttonLabel="Delete all jobs"
        disabled={actionsDisabled}
        action={clearAllJobsFormAction}
      />
    </div>
  );
}
