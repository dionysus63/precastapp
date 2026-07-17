"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllJobStructuresSubmitted } from "@/app/operations/actions";

/**
 * One-click bulk submit for the detailing flow: after the drill-sheet packet
 * goes out, every NOT_SUBMITTED structure with a sheet on the job is marked
 * as submitted. Two-click confirm — the first click arms the button.
 */
export function MarkAllSubmittedButton({
  jobId,
  count,
}: {
  jobId: string;
  count: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (count === 0 && !message) {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {count > 0 ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            setArmed(false);
            setMessage(null);
            startTransition(async () => {
              const result = await markAllJobStructuresSubmitted(jobId);
              if ("error" in result) {
                setMessage(result.error ?? "Could not submit.");
                return;
              }
              setMessage(
                `Marked ${result.submitted} structure${
                  result.submitted === 1 ? "" : "s"
                } as submitted` +
                  (result.skipped.length > 0
                    ? ` — skipped ${result.skipped.join("; ")}`
                    : "."),
              );
              router.refresh();
            });
          }}
          onBlur={() => setArmed(false)}
          className={`inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50 ${
            armed
              ? "border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {pending
            ? "Submitting…"
            : armed
              ? `Confirm: submit ${count}?`
              : `Mark All Submitted (${count})`}
        </button>
      ) : null}
      {message ? (
        <p className="max-w-sm text-right text-[10px] text-slate-500">
          {message}
        </p>
      ) : null}
    </div>
  );
}
