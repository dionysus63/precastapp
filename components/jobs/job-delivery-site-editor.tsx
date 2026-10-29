"use client";

import { useState, useTransition } from "react";
import { updateJobDeliverySiteAction } from "@/app/jobs/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  jobInputClassName,
  type JobDeliverySiteView,
} from "@/components/jobs/job-utils";
import { unwrapAction } from "@/lib/action-result";
import { reloadAfterAction } from "@/lib/reload-after-action";

type JobDeliverySiteEditorProps = {
  jobId: string;
  jobNumber: string;
  site: JobDeliverySiteView;
};

type DraftFields = {
  deliveryAddress: string;
  siteContactName: string;
  siteContactPhone: string;
  siteContactEmail: string;
};

function draftFromSite(site: JobDeliverySiteView): DraftFields {
  return {
    deliveryAddress: site.deliveryAddress,
    siteContactName: site.siteContactName,
    siteContactPhone: site.siteContactPhone,
    siteContactEmail: site.siteContactEmail,
  };
}

/**
 * "Delivery Site" card on the job overview: where loads go and who to call
 * on site. Resting state is read-only rows; Edit swaps in a small form that
 * saves through updateJobDeliverySiteAction and reloads. Blank values fall
 * back to the project address / customer field contact on tickets.
 */
export function JobDeliverySiteEditor({
  jobId,
  jobNumber,
  site,
}: JobDeliverySiteEditorProps) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftFields>(() => draftFromSite(site));
  const [error, setError] = useState<string | null>(null);

  const hasAddress = site.deliveryAddress.trim() !== "";
  const hasContact =
    site.siteContactName.trim() !== "" ||
    site.siteContactPhone.trim() !== "" ||
    site.siteContactEmail.trim() !== "";
  const projectAddress = site.projectAddressLines.join("\n");
  const hasJobContact = Boolean(
    site.jobContact.name.trim() ||
      site.jobContact.phone.trim() ||
      site.jobContact.email.trim(),
  );

  function startEditing() {
    setDraft(draftFromSite(site));
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function update<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await unwrapAction(updateJobDeliverySiteAction(jobId, draft));
        setEditing(false);
        reloadAfterAction();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not save the delivery site.",
        );
      }
    });
  }

  const action = editing ? null : (
    <button
      type="button"
      onClick={startEditing}
      aria-label={`Edit delivery site for job ${jobNumber}`}
      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
    >
      {hasAddress || hasContact ? "Edit" : "Add"}
    </button>
  );

  if (!editing) {
    return (
      <SectionCard
        title="Delivery Site"
        description="Prints on delivery tickets for this job."
        action={action}
      >
        <dl>
          <SiteRow
            label="Delivery Address"
            value={hasAddress ? site.deliveryAddress : projectAddress}
            muted={!hasAddress}
            note={
              hasAddress
                ? null
                : projectAddress
                  ? "Using the project address"
                  : "Not set"
            }
          />
          <SiteRow
            label="Site Contact"
            value={site.siteContactName}
            muted={!hasContact}
            note={hasContact ? null : "Using the customer's field contact"}
          />
          <SiteRow label="Phone" value={site.siteContactPhone} />
          <SiteRow label="Email" value={site.siteContactEmail} />
        </dl>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Delivery Site"
      description="Leave the address blank to deliver to the project address."
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="jobDeliveryAddress"
              className="block text-xs font-medium text-slate-700"
            >
              Delivery Address
            </label>
            {projectAddress ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => update("deliveryAddress", projectAddress)}
                className="text-[11px] font-medium text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-700"
              >
                Use project address
              </button>
            ) : null}
          </div>
          <textarea
            id="jobDeliveryAddress"
            rows={3}
            autoFocus
            value={draft.deliveryAddress}
            disabled={pending}
            onChange={(event) => update("deliveryAddress", event.target.value)}
            placeholder={"Street\nTown, NY 11700"}
            className={jobInputClassName}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            One line per row as it should print on the ticket.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="jobSiteContactName"
              className="block text-xs font-medium text-slate-700"
            >
              Site Contact
            </label>
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
                className="text-[11px] font-medium text-slate-500 underline decoration-dotted underline-offset-2 hover:text-slate-700"
              >
                Use job contact
              </button>
            ) : null}
          </div>
          <input
            id="jobSiteContactName"
            type="text"
            value={draft.siteContactName}
            disabled={pending}
            onChange={(event) => update("siteContactName", event.target.value)}
            placeholder="Name"
            autoComplete="off"
            className={jobInputClassName}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="jobSiteContactPhone"
              className="block text-xs font-medium text-slate-700"
            >
              Phone
            </label>
            <input
              id="jobSiteContactPhone"
              type="tel"
              value={draft.siteContactPhone}
              disabled={pending}
              onChange={(event) =>
                update("siteContactPhone", event.target.value)
              }
              autoComplete="off"
              className={jobInputClassName}
            />
          </div>
          <div>
            <label
              htmlFor="jobSiteContactEmail"
              className="block text-xs font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="jobSiteContactEmail"
              type="email"
              value={draft.siteContactEmail}
              disabled={pending}
              onChange={(event) =>
                update("siteContactEmail", event.target.value)
              }
              autoComplete="off"
              className={jobInputClassName}
            />
          </div>
        </div>

        {error ? (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

function SiteRow({
  label,
  value,
  muted = false,
  note,
}: {
  label: string;
  value: string;
  muted?: boolean;
  note?: string | null;
}) {
  const display = value.trim();
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-1.5 text-xs last:border-b-0">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right">
        <span
          className={`block whitespace-pre-line break-words ${
            display && !muted
              ? "font-medium text-slate-800"
              : display
                ? "text-slate-500"
                : "text-slate-400"
          }`}
        >
          {display || "—"}
        </span>
        {note ? (
          <span className="block text-[10px] italic text-slate-400">{note}</span>
        ) : null}
      </dd>
    </div>
  );
}
