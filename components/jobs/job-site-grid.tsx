"use client";

import { useState, useTransition } from "react";
import { updateJobDeliverySiteAction } from "@/app/jobs/actions";
import {
  JobFieldGrid,
  JobFieldRow,
  JobFieldText,
} from "@/components/jobs/job-field-grid";
import type { JobDeliverySiteView } from "@/components/jobs/job-utils";
import { unwrapAction } from "@/lib/action-result";
import { reloadAfterAction } from "@/lib/reload-after-action";
import { tableActionButtonClassName } from "@/lib/table-styles";

type JobSiteGridProps = {
  jobId: string;
  jobNumber: string;
  site: JobDeliverySiteView;
};

type DraftFields = {
  address: string;
  siteContactName: string;
  siteContactPhone: string;
  siteContactEmail: string;
};

const inputClassName =
  "block w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-normal text-slate-900 shadow-sm disabled:opacity-50";

const shortcutClassName =
  "text-2xs font-medium text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-700";

/** Address lines as one comparable string: trimmed, blank lines dropped. */
function normalizeAddress(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * The job page's address and site contact box. One address is shown: the one
 * that prints on this job's delivery tickets (the delivery address when one
 * was typed here, otherwise the job's own address). Edit swaps the rows for
 * inputs and saves through updateJobDeliverySiteAction.
 */
export function JobSiteGrid({ jobId, jobNumber, site }: JobSiteGridProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectAddress = site.projectAddressLines.join("\n");
  const shownAddress = site.deliveryAddress.trim() || projectAddress;
  const hasJobContact = Boolean(
    site.jobContact.name.trim() ||
      site.jobContact.phone.trim() ||
      site.jobContact.email.trim(),
  );

  const [draft, setDraft] = useState<DraftFields>({
    address: shownAddress,
    siteContactName: site.siteContactName,
    siteContactPhone: site.siteContactPhone,
    siteContactEmail: site.siteContactEmail,
  });

  function startEditing() {
    setDraft({
      address: shownAddress,
      siteContactName: site.siteContactName,
      siteContactPhone: site.siteContactPhone,
      siteContactEmail: site.siteContactEmail,
    });
    setError(null);
    setEditing(true);
  }

  function update<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        // An address equal to the job's own address is stored as blank, so
        // tickets keep following the job address if it is corrected later.
        const typed = normalizeAddress(draft.address);
        await unwrapAction(
          updateJobDeliverySiteAction(jobId, {
            deliveryAddress:
              typed === normalizeAddress(projectAddress) ? "" : typed,
            siteContactName: draft.siteContactName,
            siteContactPhone: draft.siteContactPhone,
            siteContactEmail: draft.siteContactEmail,
          }),
        );
        setEditing(false);
        reloadAfterAction();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not save the address and site contact.",
        );
      }
    });
  }

  if (!editing) {
    return (
      <JobFieldGrid>
        <JobFieldRow label="Job Address:">
          <div className="flex items-start justify-between gap-2">
            <JobFieldText value={shownAddress} />
            <button
              type="button"
              onClick={startEditing}
              aria-label={`Edit address and site contact for job ${jobNumber}`}
              className={`${tableActionButtonClassName} shrink-0`}
            >
              Edit
            </button>
          </div>
        </JobFieldRow>
        <JobFieldRow label="Site Contact:">
          <JobFieldText value={site.siteContactName} />
        </JobFieldRow>
        <JobFieldRow label="Site Phone:">
          <JobFieldText value={site.siteContactPhone} />
          {site.siteContactEmail.trim() ? (
            <span className="block break-all text-xs font-normal text-slate-600">
              {site.siteContactEmail}
            </span>
          ) : null}
        </JobFieldRow>
      </JobFieldGrid>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <JobFieldGrid>
        <JobFieldRow label="Job Address:">
          <textarea
            rows={2}
            autoFocus
            value={draft.address}
            disabled={pending}
            onChange={(event) => update("address", event.target.value)}
            placeholder={"Street\nTown, NY 11700"}
            aria-label="Job address, one line per row as it prints on tickets"
            className={inputClassName}
          />
          {projectAddress &&
          normalizeAddress(draft.address) !== normalizeAddress(projectAddress) ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => update("address", projectAddress)}
              className={`mt-1 ${shortcutClassName}`}
            >
              Use the address from Edit Job
            </button>
          ) : null}
        </JobFieldRow>
        <JobFieldRow label="Site Contact:">
          <input
            type="text"
            value={draft.siteContactName}
            disabled={pending}
            onChange={(event) => update("siteContactName", event.target.value)}
            aria-label="Site contact name"
            autoComplete="off"
            className={inputClassName}
          />
          {hasJobContact ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  siteContactName: site.jobContact.name,
                  siteContactPhone: site.jobContact.phone,
                  siteContactEmail: site.jobContact.email,
                }))
              }
              className={`mt-1 ${shortcutClassName}`}
            >
              Use job contact
            </button>
          ) : null}
        </JobFieldRow>
        <JobFieldRow label="Site Phone:">
          <input
            type="tel"
            value={draft.siteContactPhone}
            disabled={pending}
            onChange={(event) => update("siteContactPhone", event.target.value)}
            aria-label="Site contact phone"
            autoComplete="off"
            className={inputClassName}
          />
        </JobFieldRow>
        <JobFieldRow label="Site Email:">
          <input
            type="email"
            value={draft.siteContactEmail}
            disabled={pending}
            onChange={(event) => update("siteContactEmail", event.target.value)}
            aria-label="Site contact email"
            autoComplete="off"
            className={inputClassName}
          />
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            {error ? (
              <p className="mr-auto text-xs font-normal text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              className="rounded-lg btn-plain px-3 py-1 text-2xs font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg btn-main px-3 py-1 text-2xs font-semibold disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </JobFieldRow>
      </JobFieldGrid>
    </form>
  );
}
