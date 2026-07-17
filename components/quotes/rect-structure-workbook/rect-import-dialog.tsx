"use client";

import { useState } from "react";
import {
  gridFromTsv,
  parseRectStructureImport,
  type RectImportResult,
} from "@/lib/quotes/rect-structure-import";
import type {
  RectWorkbookOptions,
  RectWorkbookRow,
} from "@/lib/quotes/rect-structure-workbook";

type RectImportDialogProps = {
  options: RectWorkbookOptions;
  onImport: (rows: RectWorkbookRow[]) => void;
  onClose: () => void;
};

/**
 * Bulk import for the rect workbook: upload the filled-in template
 * spreadsheet (or paste its cells) and preview every structure before any
 * rows are added. Nothing touches the quote until the workbook is applied.
 */
export function RectImportDialog({
  options,
  onImport,
  onClose,
}: RectImportDialogProps) {
  const [result, setResult] = useState<RectImportResult | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");

  async function handleFile(file: File | null) {
    if (!file) {
      return;
    }
    setReadError(null);
    try {
      const xlsx = await import("xlsx");
      const workbook = xlsx.read(await file.arrayBuffer());
      const sheet =
        workbook.Sheets["Structures"] ??
        workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        setReadError("The file has no sheets.");
        return;
      }
      const grid = xlsx.utils.sheet_to_json<(string | number | null)[]>(
        sheet,
        { header: 1, defval: "" },
      );
      setSourceName(file.name);
      setResult(parseRectStructureImport(grid, options));
    } catch (error) {
      setReadError(
        error instanceof Error ? error.message : "Could not read the file.",
      );
    }
  }

  function handlePasteParse() {
    if (!pasteText.trim()) {
      return;
    }
    setReadError(null);
    setSourceName("pasted cells");
    setResult(parseRectStructureImport(gridFromTsv(pasteText), options));
  }

  const importable = result?.structures ?? [];
  const errors = result?.errors ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rect-import-title"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 id="rect-import-title" className="text-sm font-semibold text-slate-900">
            Import structures from Excel
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            One structure per row — quote-only or full drill-sheet detail.{" "}
            <a
              href="/templates/rect-structure-import.xlsx"
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
              placeholder="Copy the header row plus your structure rows in Excel and paste here."
              className="mt-2 block w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-[11px] text-slate-900"
            />
            <button
              type="button"
              onClick={handlePasteParse}
              className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Preview pasted rows
            </button>
          </details>

          {readError ? (
            <p className="text-xs font-medium text-red-600">{readError}</p>
          ) : null}
          {result && !result.headerFound ? (
            <p className="text-xs font-medium text-red-600">
              Couldn&apos;t find the header row — keep the &quot;Structure
              #&quot; and &quot;Template&quot; column headings from the
              template.
            </p>
          ) : null}

          {errors.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-red-700">
                {errors.length} row{errors.length === 1 ? "" : "s"} skipped:
              </p>
              <ul className="mt-1 list-disc pl-4 text-[11px] text-red-700">
                {errors.map((error) => (
                  <li key={`${error.rowNumber}-${error.message}`}>
                    Row {error.rowNumber}
                    {error.structureNumber ? ` (${error.structureNumber})` : ""}
                    : {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {importable.length > 0 ? (
            <table className="min-w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-1 pr-3">Structure</th>
                  <th className="py-1 pr-3">Template</th>
                  <th className="py-1 pr-3">Detail</th>
                  <th className="py-1 pr-3">Pipes</th>
                  <th className="py-1">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importable.map((structure) => (
                  <tr key={structure.row.id}>
                    <td className="py-1 pr-3 font-medium text-slate-900">
                      {structure.structureNumber}
                    </td>
                    <td className="py-1 pr-3 text-slate-600">
                      {structure.templateName}
                    </td>
                    <td className="py-1 pr-3">
                      {structure.detailLevel === "FULL" ? (
                        <span className="font-medium text-emerald-700">
                          Drill sheet
                        </span>
                      ) : (
                        <span className="text-slate-600">Quote only</span>
                      )}
                    </td>
                    <td className="py-1 pr-3 tabular-nums text-slate-600">
                      {structure.pipeCount}
                    </td>
                    <td className="py-1 text-amber-700">
                      {structure.warnings.join(" ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : result && result.headerFound ? (
            <p className="text-xs text-slate-500">
              No importable structures found.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={importable.length === 0}
            onClick={() => {
              onImport(importable.map((structure) => structure.row));
              onClose();
            }}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            Add {importable.length > 0 ? importable.length : ""} structure
            {importable.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
