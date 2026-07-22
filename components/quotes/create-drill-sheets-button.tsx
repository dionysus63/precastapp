"use client";

import { useState, useTransition } from "react";
import { createDrillSheetsFromQuote } from "@/app/quotes/structure-actions";
import { reloadAfterAction } from "@/lib/reload-after-action";

type CreateDrillSheetsButtonProps = {
  quoteId: string;
  readyCount: number;
  createdCount: number;
  canEdit: boolean;
};

export function CreateDrillSheetsButton({
  quoteId,
  readyCount,
  createdCount,
  canEdit,
}: CreateDrillSheetsButtonProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (readyCount === 0 && createdCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {readyCount > 0 ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              setError(null);
              try {
                const result = await createDrillSheetsFromQuote(quoteId);
                setMessage(
                  result.created > 0
                    ? `${result.created} drill sheet${result.created === 1 ? "" : "s"} created`
                    : "No new drill sheets to create",
                );
                reloadAfterAction();
              } catch (caught) {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "Could not create drill sheets.",
                );
              }
            })
          }
          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
        >
          Create Drill Sheets ({readyCount} ready)
        </button>
      ) : null}
      {createdCount > 0 ? (
        <a
          href="#structures-submittals"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          View Drill Sheets ({createdCount})
        </a>
      ) : null}
      {message ? (
        <span className="text-[11px] text-emerald-700">{message}</span>
      ) : null}
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
      {canEdit && readyCount > 0 ? (
        <span className="text-[11px] text-slate-500">
          Quote-only lines can be completed in{" "}
          <a
            href={`/quotes/${quoteId}/edit/structures`}
            className="font-semibold text-sky-800 underline"
          >
            Circular Structure Workbook
          </a>
          .
        </span>
      ) : null}
    </div>
  );
}

function StructureDrillSheetBadge({
  status,
  jobStructureId,
}: {
  status: "created" | "ready" | "quote_only" | null | undefined;
  jobStructureId?: string | null;
}) {
  if (!status) {
    return null;
  }

  if (status === "created" && jobStructureId) {
    return (
      <a
        href={`/drill-sheets/${jobStructureId}`}
        className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-200"
      >
        Drill sheet created
      </a>
    );
  }

  if (status === "ready") {
    return (
      <span className="mt-1 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
        Ready for drill sheet
      </span>
    );
  }

  return (
    <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
      Quote only — details needed
    </span>
  );
}

export { StructureDrillSheetBadge };
