"use client";

import { useState } from "react";
import {
  importCustomJobStructures,
  type JobStructureImportResult,
} from "@/app/jobs/structure-import-actions";
import { reloadAfterAction } from "@/lib/reload-after-action";
import {
  customGridFromTsv,
  parseCustomStructureImport,
  type CustomImportResult,
} from "@/lib/custom-structure-import";

/**
 * Bulk add CUSTOM structures to a job: plain tracked pieces with a number,
 * description, and quantity — one row per unique piece type (a 1,500-piece
 * sound wall imports as ~50 rows). Mirrors the drill-sheet Import
 * Structures dialog's upload/paste UX.
 */
export function JobCustomStructureImportButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<CustomImportResult | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<JobStructureImportResult | null>(null);

  function openDialog() {
    setOpen(true);
    setParsed(null);
    setResult(null);
    setReadError(null);
    setSourceName(null);
    setPasteText("");
  }

  function parseGrid(
    grid: (string | number | boolean | null | undefined)[][],
    name: string,
  ) {
    setReadError(null);
    setResult(null);
    setSourceName(name);
    const built = parseCustomStructureImport(grid);
    if (!built.headerFound) {
      setParsed(null);
      setReadError(
        'Couldn\'t find the header row — keep at least the "Structure #" and "Description" column headings.',
      );
      return;
    }
    setParsed(built);
  }

  async function handleFile(file: File | null) {
    if (!file) {
      return;
    }
    try {
      const xlsx = await import("xlsx");
      const workbook = xlsx.read(await file.arrayBuffer());
      const sheet =
        workbook.Sheets["Structures"] ?? workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        setReadError("The file has no sheets.");
        return;
      }
      const grid = xlsx.utils.sheet_to_json<(string | number | null)[]>(sheet, {
        header: 1,
        defval: "",
      });
      parseGrid(grid, file.name);
    } catch (error) {
      setReadError(
        error instanceof Error ? error.message : "Could not read the file.",
      );
    }
  }

  const rows = parsed?.rows ?? [];
  const totalPieces = rows.reduce((sum, row) => sum + row.entry.quantity, 0);

  async function handleImport() {
    if (rows.length === 0) {
      return;
    }
    setImporting(true);
    try {
      const outcome = await importCustomJobStructures(
        jobId,
        rows.map((row) => row.entry),
      );
      setResult(outcome);
      if (outcome.created > 0) {
        reloadAfterAction();
      }
    } catch (error) {
      setReadError(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
      >
        Add Custom Structures
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-custom-import-title"
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h3
                id="job-custom-import-title"
                className="text-sm font-semibold text-slate-900"
              >
                Add custom structures to this job
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                One row per unique piece type — the quantity carries the piece
                count. No template or drill sheet; submittals attach as
                uploads.{" "}
                <a
                  href="/templates/custom-structure-import.xlsx"
                  download
                  className="font-medium text-sky-700 hover:text-sky-900"
                >
                  Download the blank template
                </a>
                .
              </p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                  Choose .xlsx file…
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="sr-only"
                    onChange={(event) => {
                      void handleFile(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                  />
                </label>
                {sourceName ? (
                  <span className="text-[11px] text-slate-500">{sourceName}</span>
                ) : null}
              </div>

              <details className="rounded-lg border border-slate-200 px-3 py-2">
                <summary className="cursor-pointer text-[11px] font-medium text-slate-600">
                  …or paste cells from Excel
                </summary>
                <textarea
                  rows={5}
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder="Copy the header row plus your piece rows in Excel and paste here."
                  className="mt-2 block w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-[11px] text-slate-900"
                />
                <button
                  type="button"
                  onClick={() =>
                    parseGrid(customGridFromTsv(pasteText), "pasted cells")
                  }
                  className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Preview pasted rows
                </button>
              </details>

              {readError ? (
                <p className="text-xs font-medium text-red-600">{readError}</p>
              ) : null}

              {parsed && parsed.errors.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-red-700">
                    {parsed.errors.length} row
                    {parsed.errors.length === 1 ? "" : "s"} skipped:
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-[11px] text-red-700">
                    {parsed.errors.map((error) => (
                      <li key={`${error.rowNumber}-${error.message}`}>
                        Row {error.rowNumber}
                        {error.structureNumber ? ` (${error.structureNumber})` : ""}
                        : {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {rows.length > 0 ? (
                <>
                  <table className="min-w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="py-1 pr-3">Structure</th>
                        <th className="py-1 pr-3">Description</th>
                        <th className="py-1 pr-3">Qty</th>
                        <th className="py-1 pr-3">Weight Each</th>
                        <th className="py-1">Submittal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td className="py-1 pr-3 font-medium text-slate-900">
                            {row.entry.structureNumber}
                          </td>
                          <td className="py-1 pr-3 text-slate-600">
                            {row.entry.description}
                          </td>
                          <td className="py-1 pr-3 tabular-nums text-slate-600">
                            {row.entry.quantity} {row.entry.unit}
                          </td>
                          <td className="py-1 pr-3 tabular-nums text-slate-600">
                            {row.entry.weightEachLbs != null
                              ? `${row.entry.weightEachLbs.toLocaleString("en-US")} lbs`
                              : "—"}
                          </td>
                          <td className="py-1 text-slate-600">
                            {row.entry.needsSubmittal ? "Needed" : "Not needed"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[11px] text-slate-500">
                    {rows.length} piece type{rows.length === 1 ? "" : "s"} ·{" "}
                    {totalPieces.toLocaleString("en-US")} total piece
                    {totalPieces === 1 ? "" : "s"}.
                  </p>
                </>
              ) : parsed && parsed.headerFound ? (
                <p className="text-xs text-slate-500">No importable rows found.</p>
              ) : null}

              {result ? (
                <div
                  className={`rounded-lg border px-3 py-2 text-[11px] ${
                    result.errors.length > 0
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                  }`}
                >
                  <p className="font-semibold">
                    {result.created} structure
                    {result.created === 1 ? "" : "s"} added to the job.
                  </p>
                  {result.errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {result ? "Close" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={rows.length === 0 || importing || result != null}
                onClick={() => void handleImport()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {importing
                  ? "Adding…"
                  : `Add ${rows.length > 0 ? rows.length : ""} structure${
                      rows.length === 1 ? "" : "s"
                    }`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
