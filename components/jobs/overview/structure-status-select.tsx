"use client";

import { useState, useTransition } from "react";
import {
  bulkSetJobStructureStatuses,
  type BulkStructureStatus,
} from "@/app/operations/actions";
import { structureStatusOptions } from "@/components/structures/structure-utils";
import { reloadAfterAction } from "@/lib/reload-after-action";

/** The statuses a structure can be moved to by hand. Shipped comes from a delivered load. */
const PICKABLE: BulkStructureStatus[] = [
  "SUBMITTED",
  "APPROVED",
  "IN_PRODUCTION",
  "MADE",
];

const labels: Record<string, string> = Object.fromEntries(
  structureStatusOptions.map((option) => [option.value, option.label]),
);

// Same tones as the status badge, so the dropdown still reads as a status.
function selectToneClassName(status: string): string {
  switch (status) {
    case "MADE":
    case "SHIPPED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "APPROVED":
    case "IN_PRODUCTION":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "SUBMITTED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

/**
 * Change one structure's status from the job Overview. It sets the status
 * directly, the way "Set status" on the Production tab does for ticked rows
 * (no submittal upload is asked for).
 */
export function StructureStatusSelect({
  jobId,
  structureId,
  structureNumber,
  status,
}: {
  jobId: string;
  structureId: string;
  structureNumber: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);

  // Adopt a server refresh during render.
  const [prevStatus, setPrevStatus] = useState(status);
  if (status !== prevStatus) {
    setPrevStatus(status);
    setValue(status);
  }

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.currentTarget.value as BulkStructureStatus;
    if (next === value || pending) {
      return;
    }
    const previous = value;
    setError(null);
    setValue(next);
    startTransition(async () => {
      const result = await bulkSetJobStructureStatuses(
        jobId,
        [structureId],
        next,
        false,
      );
      if ("error" in result && result.error) {
        setError(result.error);
        setValue(previous);
        return;
      }
      reloadAfterAction();
    });
  }

  return (
    <div>
      <select
        value={value}
        onChange={handleChange}
        disabled={pending}
        aria-label={`Change status of ${structureNumber}`}
        className={`block w-32 rounded-md border px-2 py-1 text-xs font-medium shadow-sm ${selectToneClassName(
          value,
        )} ${pending ? "opacity-60" : ""}`}
      >
        {PICKABLE.includes(value as BulkStructureStatus) ? null : (
          <option value={value}>{labels[value] ?? value}</option>
        )}
        {PICKABLE.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 max-w-[12rem] text-3xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
