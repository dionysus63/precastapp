"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { OneOffCreateResult } from "@/app/quotes/one-off-actions";
import { PdfDragChip } from "@/components/common/pdf-drag-chip";
import { SectionCard } from "@/components/dashboard/section-card";
import { DrillSheetPdfCanvasPreview } from "@/components/drill-sheets/drill-sheet-pdf-canvas-preview";

const chipClassName =
  "rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50";

function safeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").trim() || "sheet";
}

/**
 * The finished drill sheets as cards: drag a card's PDF chip onto an email,
 * a folder, or the desktop, or pick a card to view its sheet alongside.
 */
export function OneOffResults({
  result,
  onStartOver,
  mode = "created",
}: {
  result: OneOffCreateResult;
  onStartOver: () => void;
  /** "updated" after saving edits to sheets that already existed. */
  mode?: "created" | "updated";
}) {
  const [viewingId, setViewingId] = useState<string | null>(
    result.sheets[0]?.id ?? null,
  );
  const [activePage, setActivePage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const handlePageCountChange = useCallback((count: number) => {
    setPageCount(count);
  }, []);
  const viewing = result.sheets.find((sheet) => sheet.id === viewingId) ?? null;

  function view(sheetId: string) {
    setViewingId(sheetId);
    setActivePage(1);
  }
  const allIds = result.sheets.map((sheet) => sheet.id).join(",");
  const packetHref = `/api/jobs/${result.jobId}/drill-sheets?structureIds=${allIds}`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <p className="font-semibold">
          {result.sheets.length} drill sheet{result.sheets.length === 1 ? "" : "s"}{" "}
          {mode} on{" "}
          {result.jobCreated ? "new job " : "job "}
          <Link href={`/jobs/${result.jobId}`} className="underline">
            {result.jobNumber} — {result.projectName}
          </Link>
          .
        </p>
        {result.jobCreated && !result.folderCreated ? (
          <p className="mt-1 text-xs text-amber-800">
            The job&apos;s folders couldn&apos;t be created on the file share.
            Use Create Folder on the job page to try again.
          </p>
        ) : null}
        {result.errors.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 text-xs text-red-700">
            {result.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {result.sheets.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <SectionCard
            title="Drill Sheets"
            description="Drag a PDF chip onto an email or folder. Click a card to view it."
            action={
              <div className="flex items-center gap-1.5">
                <PdfDragChip
                  href={`${packetHref}&download=1`}
                  fileName={`drill-sheets-${safeFilePart(result.jobNumber)}.pdf`}
                  title="Drag all of these sheets as one PDF — or click to download."
                  label="All"
                  className={chipClassName}
                />
                <a
                  href={packetHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={chipClassName}
                >
                  Open All
                </a>
              </div>
            }
          >
            <ul className="space-y-2">
              {result.sheets.map((sheet) => {
                const active = sheet.id === viewingId;
                return (
                  <li key={sheet.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => view(sheet.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          view(sheet.id);
                        }
                      }}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
                        active
                          ? "border-sky-400 bg-sky-50"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {sheet.structureNumber}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {sheet.shape === "CIRCULAR" ? "Circular" : "Rectangular"} ·{" "}
                          {sheet.templateName}
                          {sheet.wallHeightFeet != null
                            ? ` · ${sheet.wallHeightFeet.toFixed(2)}' wall`
                            : ""}
                        </p>
                      </div>
                      <div
                        className="flex shrink-0 items-center gap-1.5"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <PdfDragChip
                          href={`/api/drill-sheets/${sheet.id}/preview?download=1`}
                          fileName={`drill-sheet-${safeFilePart(sheet.structureNumber)}.pdf`}
                          title="Drag onto an email, folder, or your desktop to copy this drill sheet — or click to download."
                          className={chipClassName}
                        />
                        <Link
                          href={`/drill-sheets/${sheet.id}`}
                          className={chipClassName}
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard
            title={viewing ? `Viewing ${viewing.structureNumber}` : "Viewer"}
            noPadding
          >
            {viewing ? (
              <div className="space-y-3 p-4">
                {pageCount > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: pageCount }, (_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setActivePage(index + 1)}
                        className={`rounded border px-3 py-1 text-xs font-semibold ${
                          activePage === index + 1
                            ? "border-slate-800 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        Sheet {index + 1}
                      </button>
                    ))}
                  </div>
                ) : null}
                <DrillSheetPdfCanvasPreview
                  key={viewing.id}
                  drillSheetId={viewing.id}
                  activeSheet={activePage}
                  onSheetCountChange={handlePageCountChange}
                />
              </div>
            ) : (
              <p className="p-4 text-sm text-slate-500">Pick a sheet to view it.</p>
            )}
          </SectionCard>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/jobs/${result.jobId}`}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Go to Job
        </Link>
        {mode === "created" && result.sheets.length > 0 ? (
          <Link
            href={`/quotes/one-off?edit=${result.jobId}&sheets=${allIds}`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit These Sheets
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onStartOver}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          {mode === "created" ? "Start Another One-Off" : "Keep Editing"}
        </button>
      </div>
    </div>
  );
}
