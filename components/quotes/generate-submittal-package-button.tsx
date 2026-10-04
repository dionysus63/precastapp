"use client";

import { useState, useTransition } from "react";
import { generateSubmittalPackage } from "@/app/quotes/pdf-actions";
import { reloadAfterAction } from "@/lib/reload-after-action";

export function GenerateSubmittalPackageButton({
  quoteId,
}: {
  quoteId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    | { type: "success"; filePath: string; missing: string[]; skipped: string[] }
    | { type: "error"; message: string }
    | null
  >(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            const response = await generateSubmittalPackage(quoteId);
            if (!response.success) {
              setResult({ type: "error", message: response.error });
              return;
            }

            // Reload so the quote page lists the new package; the summary
            // (incl. anything missing or skipped) carries over as a toast.
            const notes = [
              response.missing.length > 0
                ? `Missing submittals for: ${response.missing.join(", ")}.`
                : null,
              response.skipped.length > 0
                ? `Skipped unsupported files: ${response.skipped.join("; ")}.`
                : null,
            ].filter(Boolean);
            reloadAfterAction({
              type: notes.length > 0 ? "warning" : "success",
              text: [`Package saved: ${response.filePath}`, ...notes].join(" "),
            });
          })
        }
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Generating…" : "Generate Submittal Package"}
      </button>

      {result?.type === "success" ? (
        <div className="space-y-1 text-[11px] text-green-700">
          <p>Package saved: {result.filePath}</p>
          {result.missing.length > 0 ? (
            <p className="text-amber-700">
              Missing submittals for: {result.missing.join(", ")}
            </p>
          ) : null}
          {result.skipped.length > 0 ? (
            <p className="text-amber-700">
              Skipped unsupported files: {result.skipped.join("; ")}
            </p>
          ) : null}
        </div>
      ) : null}
      {result?.type === "error" ? (
        <p className="text-[11px] text-red-600">{result.message}</p>
      ) : null}
    </div>
  );
}
