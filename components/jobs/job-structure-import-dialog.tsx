"use client";

import { useState } from "react";
import {
  importJobStructuresFromConfigs,
  loadJobStructureImportOptions,
  type JobStructureImportEntry,
  type JobStructureImportResult,
} from "@/app/jobs/structure-import-actions";
import {
  circularGridFromTsv,
  parseCircularStructureImport,
} from "@/lib/quotes/circular-structure-import";
import { parseRectStructureImport } from "@/lib/quotes/rect-structure-import";
import { commitWorkbookRowPrice } from "@/lib/quotes/structure-workbook";
import { computeRectWorkbookRow } from "@/lib/quotes/rect-structure-workbook";
import { reloadAfterAction } from "@/lib/reload-after-action";

type ImportOptions = Awaited<ReturnType<typeof loadJobStructureImportOptions>>;

type Cell = string | number | boolean | null | undefined;

type PreviewStructure = {
  key: string;
  structureNumber: string;
  templateName: string;
  detail: string;
  pipeCount: number;
  entry: JobStructureImportEntry | null;
  /** Why this structure cannot be imported here (null = importable). */
  blocked: string | null;
  warnings: string[];
};

type PreviewState = {
  shape: "CIRCULAR" | "RECTANGULAR";
  structures: PreviewStructure[];
  parseErrors: { rowNumber: number; structureNumber: string; message: string }[];
  headerFound: boolean;
};

/**
 * The two spreadsheets have distinct headers: circular has a Diameter
 * column, rectangular has per-opening Wall columns.
 */
function detectShape(grid: Cell[][]): "CIRCULAR" | "RECTANGULAR" | null {
  for (let index = 0; index < Math.min(grid.length, 10); index += 1) {
    const headers = (grid[index] ?? []).map((cell) =>
      String(cell ?? "").toLowerCase(),
    );
    if (!headers.some((header) => header.includes("structure"))) {
      continue;
    }
    if (headers.some((header) => header.trim().startsWith("diameter"))) {
      return "CIRCULAR";
    }
    if (headers.some((header) => /opening\s*\d+\s*wall/.test(header))) {
      return "RECTANGULAR";
    }
  }
  return null;
}

function buildPreview(grid: Cell[][], options: ImportOptions): PreviewState | null {
  const shape = detectShape(grid);
  if (!shape) {
    return null;
  }

  if (shape === "CIRCULAR") {
    const parsed = parseCircularStructureImport(grid, options.circular);
    return {
      shape,
      headerFound: parsed.headerFound,
      parseErrors: parsed.errors,
      structures: parsed.structures.map((structure) => {
        // Full sheets only here — price/compute in drill-sheet mode to get
        // the same config the quote workbook would produce.
        const computed = commitWorkbookRowPrice(
          structure.row,
          options.circular,
          "DRILL_SHEET",
        );
        const config = computed.structureConfig;
        const ready =
          structure.detailLevel === "FULL" &&
          config?.detailLevel === "DRILL_SHEET" &&
          !config.errorMessage;
        return {
          key: structure.row.id,
          structureNumber: structure.structureNumber,
          templateName: `${structure.diameterFeet}' ${structure.templateName}`,
          detail: structure.detailLevel === "FULL" ? "Drill sheet" : "Quote only",
          pipeCount: structure.pipeCount,
          entry: ready
            ? {
                structureNumber: structure.structureNumber,
                shape: "CIRCULAR",
                config,
              }
            : null,
          blocked: ready
            ? null
            : structure.detailLevel !== "FULL"
              ? "Quote-only row — add opening inverts, or import it through the quote workbook."
              : config?.errorMessage || computed.status,
          warnings: structure.warnings,
        };
      }),
    };
  }

  const parsed = parseRectStructureImport(grid, options.rect);
  return {
    shape,
    headerFound: parsed.headerFound,
    parseErrors: parsed.errors,
    structures: parsed.structures.map((structure) => {
      const computed = computeRectWorkbookRow(
        structure.row,
        options.rect,
        "FULL",
      );
      const config = computed.config;
      const ready =
        structure.detailLevel === "FULL" &&
        config?.detailLevel === "FULL" &&
        !config.errorMessage;
      return {
        key: structure.row.id,
        structureNumber: structure.structureNumber,
        templateName: structure.templateName,
        detail: structure.detailLevel === "FULL" ? "Drill sheet" : "Quote only",
        pipeCount: structure.pipeCount,
        entry: ready
          ? {
              structureNumber: structure.structureNumber,
              shape: "RECTANGULAR",
              config,
            }
          : null,
        blocked: ready
          ? null
          : structure.detailLevel !== "FULL"
            ? "Quote-only row — add walls and inverts, or import it through the quote workbook."
            : config?.errorMessage || computed.status,
        warnings: structure.warnings,
      };
    }),
  };
}

/**
 * Detailing flow: bulk-create real drill sheets straight on the job from
 * the same import spreadsheets the quote workbooks use. Full-detail rows
 * become drill sheets immediately; quote-only rows are listed with a
 * pointer to the quote workbook.
 */
export function JobStructureImportButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ImportOptions | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<JobStructureImportResult | null>(null);

  async function openDialog() {
    setOpen(true);
    setPreview(null);
    setResult(null);
    setReadError(null);
    setSourceName(null);
    setPasteText("");
    if (!options) {
      try {
        setOptions(await loadJobStructureImportOptions());
      } catch {
        setReadError("Could not load template options — try again.");
      }
    }
  }

  function parseGrid(grid: Cell[][], name: string) {
    if (!options) {
      return;
    }
    setReadError(null);
    setResult(null);
    setSourceName(name);
    const built = buildPreview(grid, options);
    if (!built) {
      setPreview(null);
      setReadError(
        "Couldn't tell which template this is — keep the headers from the circular or rectangular import spreadsheet.",
      );
      return;
    }
    setPreview(built);
  }

  async function handleFile(file: File | null) {
    if (!file || !options) {
      return;
    }
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
      parseGrid(grid, file.name);
    } catch (error) {
      setReadError(
        error instanceof Error ? error.message : "Could not read the file.",
      );
    }
  }

  const importable =
    preview?.structures.filter(
      (structure): structure is PreviewStructure & { entry: JobStructureImportEntry } =>
        structure.entry != null,
    ) ?? [];

  async function handleImport() {
    if (importable.length === 0) {
      return;
    }
    setImporting(true);
    try {
      const outcome = await importJobStructuresFromConfigs(
        jobId,
        importable.map((structure) => structure.entry),
      );
      setResult(outcome);
      if (outcome.created > 0) {
        reloadAfterAction();
      }
    } catch (error) {
      setReadError(
        error instanceof Error ? error.message : "Import failed.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openDialog()}
        className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100"
      >
        Import Drill Sheet
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-structure-import-title"
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h3
                id="job-structure-import-title"
                className="text-sm font-semibold text-slate-900"
              >
                Import structures onto this job
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Full drill-sheet rows become real drill sheets on the job —
                no quote needed. Templates:{" "}
                <a
                  href="/templates/circular-structure-import.xlsx"
                  download
                  className="font-medium text-sky-700 hover:text-sky-900"
                >
                  circular
                </a>{" "}
                ·{" "}
                <a
                  href="/templates/rect-structure-import.xlsx"
                  download
                  className="font-medium text-sky-700 hover:text-sky-900"
                >
                  rectangular
                </a>
                . The shape is detected from the headers.
              </p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={`cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 ${
                    options ? "" : "pointer-events-none opacity-50"
                  }`}
                >
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
                  <span className="text-[11px] text-slate-500">
                    {sourceName}
                    {preview
                      ? ` — ${preview.shape === "CIRCULAR" ? "circular" : "rectangular"}`
                      : ""}
                  </span>
                ) : !options ? (
                  <span className="text-[11px] text-slate-400">Loading…</span>
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
                  disabled={!options}
                  onClick={() =>
                    parseGrid(circularGridFromTsv(pasteText), "pasted cells")
                  }
                  className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Preview pasted rows
                </button>
              </details>

              {readError ? (
                <p className="text-xs font-medium text-red-600">{readError}</p>
              ) : null}

              {preview && preview.parseErrors.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-red-700">
                    {preview.parseErrors.length} row
                    {preview.parseErrors.length === 1 ? "" : "s"} skipped:
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-[11px] text-red-700">
                    {preview.parseErrors.map((error) => (
                      <li key={`${error.rowNumber}-${error.message}`}>
                        Row {error.rowNumber}
                        {error.structureNumber
                          ? ` (${error.structureNumber})`
                          : ""}
                        : {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {preview && preview.structures.length > 0 ? (
                <table className="min-w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-1 pr-3">Structure</th>
                      <th className="py-1 pr-3">Template</th>
                      <th className="py-1 pr-3">Pipes</th>
                      <th className="py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.structures.map((structure) => (
                      <tr key={structure.key}>
                        <td className="py-1 pr-3 font-medium text-slate-900">
                          {structure.structureNumber}
                        </td>
                        <td className="py-1 pr-3 text-slate-600">
                          {structure.templateName}
                        </td>
                        <td className="py-1 pr-3 tabular-nums text-slate-600">
                          {structure.pipeCount}
                        </td>
                        <td className="py-1">
                          {structure.blocked ? (
                            <span className="text-amber-700">
                              {structure.blocked}
                            </span>
                          ) : (
                            <span className="font-medium text-emerald-700">
                              Ready — drill sheet
                              {structure.warnings.length > 0
                                ? ` (${structure.warnings.join(" ")})`
                                : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : preview && preview.headerFound ? (
                <p className="text-xs text-slate-500">
                  No importable structures found.
                </p>
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
                    {result.created} drill sheet
                    {result.created === 1 ? "" : "s"} created on the job.
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
                disabled={importable.length === 0 || importing || result != null}
                onClick={() => void handleImport()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {importing
                  ? "Creating…"
                  : `Create ${importable.length > 0 ? importable.length : ""} drill sheet${
                      importable.length === 1 ? "" : "s"
                    }`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
