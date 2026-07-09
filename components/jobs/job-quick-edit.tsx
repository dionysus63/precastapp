"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  updateJobCustomerAction,
  updateJobStatusAction,
} from "@/app/jobs/actions";
import {
  jobStatusFormOptions,
  type JobStatusVariant,
} from "@/components/jobs/job-utils";

export type AssignableCustomer = {
  id: string;
  name: string;
};

// Mirrors the StatusBadge palette so the select reads like the familiar badge
// while being directly editable.
const statusSelectVariantClassName: Record<string, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-zinc-200 bg-zinc-100 text-zinc-600",
  default: "border-slate-200 bg-slate-100 text-slate-700",
};

export function JobStatusSelect({
  jobId,
  jobNumber,
  statusValue,
  statusVariant,
}: {
  jobId: string;
  jobNumber: string;
  statusValue: string;
  statusVariant: JobStatusVariant;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(statusValue);
  const [lastServerStatus, setLastServerStatus] = useState(statusValue);
  const [error, setError] = useState<string | null>(null);

  // Resync the optimistic value when the server row changes underneath us.
  if (statusValue !== lastServerStatus) {
    setLastServerStatus(statusValue);
    setStatus(statusValue);
  }

  function handleChange(nextStatus: string) {
    const previous = status;
    setStatus(nextStatus);
    setError(null);
    startTransition(async () => {
      try {
        await updateJobStatusAction(jobId, nextStatus);
        router.refresh();
      } catch (caught) {
        setStatus(previous);
        setError(
          caught instanceof Error ? caught.message : "Could not update status.",
        );
      }
    });
  }

  return (
    <div>
      <select
        value={status}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value)}
        aria-label={`Status for job ${jobNumber}`}
        className={`cursor-pointer rounded-full border py-0.5 pl-2 pr-6 text-[11px] font-medium disabled:opacity-50 ${
          statusSelectVariantClassName[statusVariant] ??
          statusSelectVariantClassName.default
        }`}
      >
        {jobStatusFormOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 max-w-[160px] text-[10px] text-red-600">{error}</p>
      ) : null}
    </div>
  );
}

export function JobCustomerEditor({
  jobId,
  jobNumber,
  customerId: serverCustomerId,
  customerName,
  customers,
}: {
  jobId: string;
  jobNumber: string;
  customerId: string | null;
  customerName: string;
  customers: AssignableCustomer[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const displayName =
    customerName && customerName !== "Unassigned" ? customerName : null;

  function choose(nextId: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await updateJobCustomerAction(jobId, nextId);
        setEditing(false);
        setQuery("");
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not update contractor.",
        );
      }
    });
  }

  function cancel() {
    setEditing(false);
    setQuery("");
    setError(null);
  }

  // Changing the contractor is rare (winning a quote usually assigns it), so
  // the resting state is plain text with a low-key "change" link; clicking it
  // swaps in a search picker.
  if (!editing) {
    return (
      <span className="inline-flex items-baseline gap-1.5">
        <span
          className={`text-sm ${displayName ? "font-medium text-slate-800" : "italic text-slate-400"}`}
        >
          {displayName ?? "No contractor"}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Change contractor for job ${jobNumber}`}
          className="text-[11px] font-medium text-slate-400 underline decoration-dotted underline-offset-2 hover:text-slate-600"
        >
          change
        </button>
      </span>
    );
  }

  const trimmedQuery = query.trim().toLowerCase();
  const matches = (
    trimmedQuery
      ? customers.filter((customer) =>
          customer.name.toLowerCase().includes(trimmedQuery),
        )
      : customers
  ).slice(0, 8);

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          type="text"
          value={query}
          disabled={pending}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              cancel();
            }
            if (event.key === "Enter" && matches.length === 1) {
              choose(matches[0].id);
            }
          }}
          placeholder="Search contractors…"
          aria-label={`Contractor for job ${jobNumber}`}
          className="w-56 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm disabled:opacity-50"
        />
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          aria-label="Cancel contractor change"
          className="rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
        >
          ✕
        </button>
      </div>
      <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
        {pending ? (
          <p className="px-3 py-2 text-xs text-slate-500">Saving…</p>
        ) : (
          <>
            {serverCustomerId ? (
              <button
                type="button"
                onClick={() => choose(null)}
                className="block w-full px-3 py-1.5 text-left text-xs italic text-slate-500 hover:bg-slate-50"
              >
                Remove contractor
              </button>
            ) : null}
            {matches.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => choose(customer.id)}
                className={`block w-full truncate px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${
                  customer.id === serverCustomerId
                    ? "font-semibold text-slate-900"
                    : "text-slate-700"
                }`}
              >
                {customer.name}
              </button>
            ))}
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">
                No contractors match.
              </p>
            ) : null}
          </>
        )}
        {error ? (
          <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
