"use client";

import { useState, useTransition } from "react";
import { generateJobDrillSheetsPdf } from "@/app/drill-sheets/pdf-actions";
import { openPathOnClient } from "@/lib/open-on-client";

/**
 * View/save the job's combined drill-sheet packet: "View All" opens the
 * merged PDF inline; "Save All" writes it into the job folder's cut-sheets
 * subfolder.
 */
export function JobDrillSheetsPdfButtons({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <a
          href={`/api/jobs/${jobId}/drill-sheets`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
        >
          View All Sheets
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const result = await generateJobDrillSheetsPdf(jobId);
              if (result.success) {
                if (!result.launched) {
                  await openPathOnClient(result.filePath);
                }
                setMessage(
                  `Saved ${result.included} sheet${result.included === 1 ? "" : "s"}: ${result.filePath}` +
                    (result.skipped.length > 0
                      ? ` — skipped ${result.skipped.join("; ")}`
                      : ""),
                );
                return;
              }
              setMessage(result.error);
            });
          }}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save All Sheets"}
        </button>
      </div>
      {message ? (
        <p className="max-w-sm text-right text-[10px] text-slate-500">
          {message}
        </p>
      ) : null}
    </div>
  );
}
