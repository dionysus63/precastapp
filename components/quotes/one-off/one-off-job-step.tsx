"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  getJobForOneOff,
  searchCustomersForOneOff,
  searchJobsForOneOff,
  type OneOffJobDetails,
  type OneOffNewJobInput,
} from "@/app/quotes/one-off-actions";
import { FormTypeahead } from "@/components/common/form-typeahead";
import { jobInputClassName } from "@/components/jobs/job-utils";
import { describeActionFailure, isActionError } from "@/lib/action-result";

export type OneOffJobChoice =
  | { mode: "existing"; job: OneOffJobDetails | null }
  | { mode: "new"; fields: OneOffNewJobInput; customerLabel: string };

export const emptyNewJobFields: OneOffNewJobInput = {
  customerId: null,
  customerName: "",
  projectName: "",
  projectAddress: "",
  city: "",
  state: "",
  zip: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
};

export function isJobChoiceComplete(choice: OneOffJobChoice | null): boolean {
  if (!choice) {
    return false;
  }
  if (choice.mode === "existing") {
    return choice.job != null;
  }
  return (
    choice.fields.projectName.trim() !== "" &&
    (choice.fields.customerId != null || choice.fields.customerName.trim() !== "")
  );
}

/** One-line summary for the collapsed step header. */
export function describeJobChoice(choice: OneOffJobChoice): string {
  if (choice.mode === "existing") {
    return choice.job
      ? `${choice.job.jobNumber} — ${choice.job.projectName} (${choice.job.customerName})`
      : "";
  }
  const contractor = choice.customerLabel || choice.fields.customerName;
  return `New job — ${choice.fields.projectName} (${contractor})`;
}

function ModeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span
        className={`mt-0.5 block text-xs ${active ? "text-slate-300" : "text-slate-500"}`}
      >
        {description}
      </span>
    </button>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-slate-900">{value?.trim() || "—"}</p>
    </div>
  );
}

export function OneOffJobStep({
  choice,
  onChange,
}: {
  choice: OneOffJobChoice | null;
  onChange: (choice: OneOffJobChoice) => void;
}) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  function selectJob(jobId: string | null) {
    setLoadError(null);
    if (!jobId) {
      onChange({ mode: "existing", job: null });
      return;
    }
    startLoading(async () => {
      try {
        const result = await getJobForOneOff(jobId);
        if (isActionError(result)) {
          setLoadError(result.error);
          return;
        }
        onChange({ mode: "existing", job: result });
      } catch (error) {
        setLoadError(describeActionFailure(error, "Could not load that job."));
      }
    });
  }

  function patchNew(patch: Partial<OneOffNewJobInput>, customerLabel?: string) {
    if (choice?.mode !== "new") {
      return;
    }
    onChange({
      mode: "new",
      fields: { ...choice.fields, ...patch },
      customerLabel: customerLabel ?? choice.customerLabel,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={choice?.mode === "existing"}
          title="Existing job"
          description="Pick a job and its contractor and address fill in."
          onClick={() =>
            choice?.mode !== "existing" &&
            onChange({ mode: "existing", job: null })
          }
        />
        <ModeCard
          active={choice?.mode === "new"}
          title="New job"
          description="Enter the contractor and job site; a job number is assigned."
          onClick={() =>
            choice?.mode !== "new" &&
            onChange({ mode: "new", fields: emptyNewJobFields, customerLabel: "" })
          }
        />
      </div>

      {choice?.mode === "existing" ? (
        <div className="space-y-4">
          <div className="max-w-xl">
            <span className="block text-xs font-medium text-slate-700">Job *</span>
            <FormTypeahead
              selectedLabel={
                choice.job
                  ? `${choice.job.jobNumber} — ${choice.job.projectName}`
                  : ""
              }
              placeholder="Search job number, project, or contractor…"
              searchItems={searchJobsForOneOff}
              itemKey={(job) => job.id}
              itemLabel={(job) => job.label}
              onSelect={(job) => selectJob(job?.id ?? null)}
              inputClassName={jobInputClassName}
            />
            {loading ? (
              <p className="mt-1 text-[11px] text-slate-500">Loading job…</p>
            ) : null}
            {loadError ? (
              <p className="mt-1 text-[11px] text-red-600">{loadError}</p>
            ) : null}
          </div>
          {choice.job ? (
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-3">
              <ReadOnlyField label="Contractor" value={choice.job.customerName} />
              <ReadOnlyField label="Project" value={choice.job.projectName} />
              <ReadOnlyField label="Job Number" value={choice.job.jobNumber} />
              <ReadOnlyField label="Address" value={choice.job.projectAddress} />
              <ReadOnlyField
                label="City / State / Zip"
                value={[choice.job.city, choice.job.state, choice.job.zip]
                  .filter(Boolean)
                  .join(", ")}
              />
              <ReadOnlyField
                label="Contact"
                value={[
                  choice.job.contactName,
                  choice.job.contactPhone,
                  choice.job.contactEmail,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <p className="text-[11px] text-slate-500 sm:col-span-3">
                {choice.job.structureNumbers.length > 0
                  ? `This job already has ${choice.job.structureNumbers.length} numbered structure${choice.job.structureNumbers.length === 1 ? "" : "s"}; new rows are numbered after them.`
                  : "This job has no structures yet."}{" "}
                To change these details, edit the job itself.
              </p>
              {choice.job.sheetCount > 0 ? (
                <p className="text-xs sm:col-span-3">
                  <Link
                    href={`/quotes/one-off?edit=${choice.job.id}`}
                    className="font-semibold text-sky-700 hover:underline"
                  >
                    Edit this job&apos;s {choice.job.sheetCount} drill sheet
                    {choice.job.sheetCount === 1 ? "" : "s"} instead →
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {choice?.mode === "new" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="block text-xs font-medium text-slate-700">
              Contractor (customer record)
            </span>
            <FormTypeahead
              selectedLabel={choice.customerLabel}
              placeholder="Search customers…"
              searchItems={searchCustomersForOneOff}
              itemKey={(customer) => customer.id}
              itemLabel={(customer) => customer.name}
              clearLabel="Not a saved customer"
              onSelect={(customer) =>
                patchNew(
                  { customerId: customer?.id ?? null },
                  customer?.name ?? "",
                )
              }
              inputClassName={jobInputClassName}
            />
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">
              {choice.fields.customerId ? "Contractor Name" : "Contractor Name *"}
            </span>
            <input
              type="text"
              value={choice.fields.customerId ? choice.customerLabel : choice.fields.customerName}
              disabled={choice.fields.customerId != null}
              onChange={(event) => patchNew({ customerName: event.target.value })}
              placeholder="One-off customer name"
              className={jobInputClassName}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">
              Project Name *
            </span>
            <input
              type="text"
              value={choice.fields.projectName}
              onChange={(event) => patchNew({ projectName: event.target.value })}
              placeholder="Main Street Drainage"
              className={jobInputClassName}
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="block text-xs font-medium text-slate-700">
              Project Address
            </span>
            <input
              type="text"
              value={choice.fields.projectAddress}
              onChange={(event) => patchNew({ projectAddress: event.target.value })}
              placeholder="120 Main Street"
              className={jobInputClassName}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">City</span>
            <input
              type="text"
              value={choice.fields.city}
              onChange={(event) => patchNew({ city: event.target.value })}
              className={jobInputClassName}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">State</span>
            <input
              type="text"
              value={choice.fields.state}
              onChange={(event) => patchNew({ state: event.target.value })}
              className={jobInputClassName}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Zip</span>
            <input
              type="text"
              value={choice.fields.zip}
              onChange={(event) => patchNew({ zip: event.target.value })}
              className={jobInputClassName}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">
              Contact Name
            </span>
            <input
              type="text"
              value={choice.fields.contactName}
              onChange={(event) => patchNew({ contactName: event.target.value })}
              className={jobInputClassName}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">
              Contact Phone
            </span>
            <input
              type="tel"
              value={choice.fields.contactPhone}
              onChange={(event) => patchNew({ contactPhone: event.target.value })}
              className={jobInputClassName}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">
              Contact Email
            </span>
            <input
              type="email"
              value={choice.fields.contactEmail}
              onChange={(event) => patchNew({ contactEmail: event.target.value })}
              className={jobInputClassName}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
