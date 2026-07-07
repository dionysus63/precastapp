"use client";

import { useState, useTransition } from "react";
import { saveDeliverySchedulePdf } from "@/app/delivery-tickets/pdf-actions";

type SchedulePrintActionsProps = {
  jobId: string;
};

const pillClassName =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50";

export function SchedulePrintActions({ jobId }: SchedulePrintActionsProps) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const result = await saveDeliverySchedulePdf(jobId);
      if (result.success) {
        setNotice(`Saved to ${result.filePath}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="ml-auto flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/jobs/${jobId}/delivery-schedule?variant=contractor`}
          target="_blank"
          rel="noreferrer"
          className={pillClassName}
        >
          Print Contractor Copy
        </a>
        <a
          href={`/api/jobs/${jobId}/delivery-schedule?variant=internal`}
          target="_blank"
          rel="noreferrer"
          className={pillClassName}
        >
          Print Internal Copy
        </a>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className={`${pillClassName} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {pending ? "Saving…" : "Save to Job Files"}
        </button>
      </div>
      {notice ? (
        <p className="max-w-[28rem] truncate text-[11px] text-emerald-700" title={notice}>
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="max-w-[28rem] text-[11px] text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
