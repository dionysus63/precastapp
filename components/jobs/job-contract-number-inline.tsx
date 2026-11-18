"use client";

import { useState, useTransition } from "react";
import { updateJobNysdotContractNumberAction } from "@/app/jobs/actions";
import { JobFieldEmpty } from "@/components/jobs/job-field-grid";
import { describeActionFailure, unwrapAction } from "@/lib/action-result";
import { reloadAfterAction } from "@/lib/reload-after-action";
import { NYSDOT_CONTRACT_NUMBER_MAX_LENGTH } from "@/lib/sheet-pin-contract";

/**
 * The job's NYSDOT Contract # in the job page's field grid, typed in place.
 * Drill sheets print it in their "Pin/Contract #" blank, so it is only filled
 * in on DOT jobs; saving it blank clears it.
 */
export function JobContractNumberInline({
  jobId,
  contractNumber,
}: {
  jobId: string;
  contractNumber: string;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(contractNumber);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await unwrapAction(updateJobNysdotContractNumberAction(jobId, value));
      } catch (caught) {
        setError(
          describeActionFailure(caught, "Could not save the contract number."),
        );
        return;
      }
      setEditing(false);
      reloadAfterAction();
    });
  }

  if (!editing) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-2">
        {contractNumber ? (
          <span className="break-all">{contractNumber}</span>
        ) : (
          <JobFieldEmpty />
        )}
        <button
          type="button"
          onClick={() => {
            setValue(contractNumber);
            setError(null);
            setEditing(true);
          }}
          className="text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline"
        >
          {contractNumber ? "edit" : "+ Add"}
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <input
        type="text"
        autoFocus
        value={value}
        disabled={pending}
        maxLength={NYSDOT_CONTRACT_NUMBER_MAX_LENGTH}
        aria-label="NYSDOT Contract number"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          } else if (event.key === "Escape") {
            setEditing(false);
          }
        }}
        placeholder="e.g. D265123"
        className="w-28 rounded border border-slate-300 px-1.5 py-0.5 text-xs font-normal text-slate-900"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded btn-main px-2 py-0.5 text-2xs font-semibold disabled:opacity-50"
      >
        {pending ? "…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={pending}
        className="rounded btn-plain px-2 py-0.5 text-2xs font-medium"
      >
        Cancel
      </button>
      {error ? (
        <span className="text-2xs font-medium text-red-600">{error}</span>
      ) : null}
    </span>
  );
}
