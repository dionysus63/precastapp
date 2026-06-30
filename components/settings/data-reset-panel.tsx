"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  clearAllCustomersFormAction,
  clearAllJobsFormAction,
  clearAllProductsFormAction,
  type DataResetStats,
} from "@/app/settings/actions";
import { SettingsFeedback } from "@/components/settings/settings-form-fields";

type DataResetPanelProps = {
  stats: DataResetStats;
};

export function DataResetPanel({ stats }: DataResetPanelProps) {
  const router = useRouter();
  const [productPassword, setProductPassword] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [jobPassword, setJobPassword] = useState("");
  const [productMessage, setProductMessage] = useState<{
    error?: string;
    success?: string;
  }>({});
  const [customerMessage, setCustomerMessage] = useState<{
    error?: string;
    success?: string;
  }>({});
  const [jobMessage, setJobMessage] = useState<{
    error?: string;
    success?: string;
  }>({});
  const [productPending, startProductTransition] = useTransition();
  const [customerPending, startCustomerTransition] = useTransition();
  const [jobPending, startJobTransition] = useTransition();

  const actionsDisabled = !stats.resetConfigured;

  function handleClearProducts() {
    startProductTransition(async () => {
      const formData = new FormData();
      formData.set("resetPassword", productPassword);
      try {
        const result = await clearAllProductsFormAction(formData);
        setProductMessage(result);
        if (result.success) {
          setProductPassword("");
          router.refresh();
        }
      } catch {
        setProductMessage({ error: "An unexpected error occurred. Please try again." });
      }
    });
  }

  function handleClearCustomers() {
    startCustomerTransition(async () => {
      const formData = new FormData();
      formData.set("resetPassword", customerPassword);
      try {
        const result = await clearAllCustomersFormAction(formData);
        setCustomerMessage(result);
        if (result.success) {
          setCustomerPassword("");
          router.refresh();
        }
      } catch {
        setCustomerMessage({ error: "An unexpected error occurred. Please try again." });
      }
    });
  }

  function handleClearJobs() {
    startJobTransition(async () => {
      const formData = new FormData();
      formData.set("resetPassword", jobPassword);
      try {
        const result = await clearAllJobsFormAction(formData);
        setJobMessage(result);
        if (result.success) {
          setJobPassword("");
          router.refresh();
        }
      } catch {
        setJobMessage({ error: "An unexpected error occurred. Please try again." });
      }
    });
  }

  return (
    <div className="space-y-6">
      {!stats.resetConfigured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Data reset is disabled until you set{" "}
          <code className="font-mono">SETTINGS_RESET_PASSWORD</code> in{" "}
          <code className="font-mono">.env</code> and restart the app.
        </p>
      ) : null}

      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
        <h3 className="text-sm font-semibold text-red-900">Clear all products</h3>
        <p className="mt-2 text-xs text-red-800">
          Deletes every product ({stats.productCount} currently in the
          database), including catalog documents and price list links. Quote,
          delivery, and job lines keep their rows but lose product links.
          Product submittal files on disk are not removed.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="reset-password-products"
              className="block text-xs font-medium text-slate-700"
            >
              Reset password
            </label>
            <input
              id="reset-password-products"
              type="password"
              value={productPassword}
              onChange={(event) => setProductPassword(event.target.value)}
              disabled={actionsDisabled || productPending}
              autoComplete="off"
              className="mt-1 w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            disabled={
              actionsDisabled || productPending || stats.productCount === 0
            }
            onClick={handleClearProducts}
            className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {productPending ? "Deleting…" : "Delete all products"}
          </button>
          <SettingsFeedback
            error={productMessage.error}
            success={productMessage.success}
          />
        </div>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
        <h3 className="text-sm font-semibold text-red-900">Clear all customers</h3>
        <p className="mt-2 text-xs text-red-800">
          Deletes every customer ({stats.customerCount} currently in the
          database) and their contacts. Job bid list entries for those
          customers are removed. Jobs, quotes, delivery tickets, and invoices
          remain but no longer reference a customer.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="reset-password-customers"
              className="block text-xs font-medium text-slate-700"
            >
              Reset password
            </label>
            <input
              id="reset-password-customers"
              type="password"
              value={customerPassword}
              onChange={(event) => setCustomerPassword(event.target.value)}
              disabled={actionsDisabled || customerPending}
              autoComplete="off"
              className="mt-1 w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            disabled={
              actionsDisabled || customerPending || stats.customerCount === 0
            }
            onClick={handleClearCustomers}
            className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {customerPending ? "Deleting…" : "Delete all customers"}
          </button>
          <SettingsFeedback
            error={customerMessage.error}
            success={customerMessage.success}
          />
        </div>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
        <h3 className="text-sm font-semibold text-red-900">Clear all jobs</h3>
        <p className="mt-2 text-xs text-red-800">
          Deletes every job ({stats.jobCount} currently in the database),
          including bid list entries, file records, and favorites. Job
          numbering sequences are reset so the next job of each year starts at
          001. Quotes, job structures, delivery tickets, and invoices remain
          but no longer reference a job. Job folders on disk are not removed.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="reset-password-jobs"
              className="block text-xs font-medium text-slate-700"
            >
              Reset password
            </label>
            <input
              id="reset-password-jobs"
              type="password"
              value={jobPassword}
              onChange={(event) => setJobPassword(event.target.value)}
              disabled={actionsDisabled || jobPending}
              autoComplete="off"
              className="mt-1 w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            disabled={actionsDisabled || jobPending || stats.jobCount === 0}
            onClick={handleClearJobs}
            className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {jobPending ? "Deleting…" : "Delete all jobs"}
          </button>
          <SettingsFeedback error={jobMessage.error} success={jobMessage.success} />
        </div>
      </div>
    </div>
  );
}
