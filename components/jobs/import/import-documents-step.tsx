"use client";

import { jobInputClassName } from "@/components/jobs/job-utils";
import { IMPORT_DOC_KINDS, type ImportDocKind } from "@/lib/job-import";
import { ImportDropZone } from "./import-drop-zone";
import type { ImportFileEntry, ImportQuoteFields } from "./import-types";

const KIND_HELP: Record<ImportDocKind, { title: string; help: string }> = {
  DRILL_SHEET: {
    title: "Drill sheets",
    help: "Saved on each structure as its production drawing.",
  },
  SUBMITTAL: {
    title: "Submittals sent",
    help: "What went out for approval.",
  },
  APPROVED_SUBMITTAL: {
    title: "Approved submittals",
    help: "Signed or stamped returns from the engineer.",
  },
};

function FileChip({
  entry,
  detail,
  onRemove,
}: {
  entry: ImportFileEntry;
  detail?: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
      <span className="flex h-8 w-7 flex-none items-center justify-center rounded bg-red-100 text-[9px] font-bold text-red-800">
        PDF
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-slate-800">{entry.name}</span>
        <span className="block text-[11px] text-slate-500">
          {detail ??
            (entry.pageCount != null
              ? `${entry.pageCount} page${entry.pageCount === 1 ? "" : "s"}`
              : `${Math.max(1, Math.round(entry.file.size / 1024))} KB`)}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${entry.name}`}
        className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Step 2: drop the quote PDF and the paperwork. Each paperwork kind is either
 * one combined PDF (split by page on the next step) or separate PDFs (matched
 * to structures by file name).
 */
export function ImportDocumentsStep({
  files,
  modes,
  quote,
  showStructurePaperwork,
  matchedTo,
  onAddFiles,
  onRemoveFile,
  onModeChange,
  onQuoteChange,
}: {
  files: ImportFileEntry[];
  modes: Record<ImportDocKind, "combined" | "separate">;
  quote: ImportQuoteFields;
  showStructurePaperwork: boolean;
  /** File key → structure number a separate file is attached to. */
  matchedTo: Map<string, string>;
  onAddFiles: (kind: ImportDocKind | "QUOTE", files: File[], combined: boolean) => void;
  onRemoveFile: (key: string) => void;
  onModeChange: (kind: ImportDocKind, mode: "combined" | "separate") => void;
  onQuoteChange: (patch: Partial<ImportQuoteFields>) => void;
}) {
  const quoteFile = files.find((entry) => entry.kind === "QUOTE");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Quote</h3>
          <p className="text-xs text-slate-500">
            The PDF is saved to the job&apos;s 02 Quotes folder. The prices
            themselves go in the grid on the next step.
          </p>
        </div>
        {quoteFile ? (
          <FileChip entry={quoteFile} onRemove={() => onRemoveFile(quoteFile.key)} />
        ) : (
          <ImportDropZone
            multiple={false}
            label="Drag the quote PDF here"
            onFiles={(dropped) => onAddFiles("QUOTE", dropped, false)}
          />
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Quote number</span>
            <input
              type="text"
              value={quote.quoteNumber}
              onChange={(event) => onQuoteChange({ quoteNumber: event.target.value })}
              placeholder="Assigned if blank"
              className={jobInputClassName}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Quote date</span>
            <input
              type="date"
              value={quote.quoteDate}
              onChange={(event) => onQuoteChange({ quoteDate: event.target.value })}
              className={jobInputClassName}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Tax rate %</span>
            <input
              type="text"
              inputMode="decimal"
              value={quote.taxRate}
              onChange={(event) => onQuoteChange({ taxRate: event.target.value })}
              className={jobInputClassName}
            />
          </label>
          <label className="block sm:col-span-3">
            <span className="block text-xs font-medium text-slate-700">
              Quote total (optional check figure)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={quote.totalCheck}
              onChange={(event) => onQuoteChange({ totalCheck: event.target.value })}
              placeholder="$0.00 before tax — step 3 warns if the grid doesn't add up to it"
              className={jobInputClassName}
            />
          </label>
        </div>
      </section>

      {showStructurePaperwork ? (
        IMPORT_DOC_KINDS.map((kind) => {
          const mode = modes[kind.value];
          const entries = files.filter((entry) => entry.kind === kind.value);
          const combinedFile = entries.find((entry) => entry.combined);
          return (
            <section
              key={kind.value}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {KIND_HELP[kind.value].title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {KIND_HELP[kind.value].help}{" "}
                    {mode === "combined"
                      ? "Pages get matched to structures on the next step."
                      : "File names like CB-3.pdf match their structure automatically."}
                  </p>
                </div>
                <div
                  role="radiogroup"
                  aria-label={`${KIND_HELP[kind.value].title} files`}
                  className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-[11px] font-semibold"
                >
                  {(["combined", "separate"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={mode === option}
                      onClick={() => onModeChange(kind.value, option)}
                      className={`px-3 py-1.5 ${
                        mode === option
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {option === "combined" ? "One combined PDF" : "Separate PDFs"}
                    </button>
                  ))}
                </div>
              </div>

              {entries.map((entry) => (
                <FileChip
                  key={entry.key}
                  entry={entry}
                  detail={
                    entry.combined
                      ? undefined
                      : matchedTo.get(entry.key)
                        ? `Matched to ${matchedTo.get(entry.key)}`
                        : "Matched to its structure by file name on the next step"
                  }
                  onRemove={() => onRemoveFile(entry.key)}
                />
              ))}

              {mode === "combined" && combinedFile ? null : (
                <ImportDropZone
                  multiple={mode === "separate"}
                  compact={entries.length > 0}
                  label={
                    mode === "combined"
                      ? "Drag the combined PDF here"
                      : entries.length > 0
                        ? "Drop more PDFs here"
                        : "Drag the PDFs here (as many as you like)"
                  }
                  onFiles={(dropped) =>
                    onAddFiles(kind.value, dropped, mode === "combined")
                  }
                />
              )}
            </section>
          );
        })
      ) : (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          A quoted job has no structures yet, so only the quote is brought in.
          When it&apos;s won, mark the quote Won and the structures are made
          from its lines, ready for drill sheets and submittals.
        </section>
      )}
    </div>
  );
}
