"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  importPipeOpenings,
  importRectOpenings,
  importStructureTemplates,
  resolveCastingReferences,
  type StructureImportResult,
} from "@/app/structures/import/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  getImportTypeDefinition,
  parseStructureImportText,
  STRUCTURE_IMPORT_TYPES,
  type StructureImportRow,
  type StructureImportType,
} from "@/lib/structure-import";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

const CASTING_COLUMN_INDEX: Partial<Record<StructureImportType, number>> = {
  "circular-templates": 12,
  "rect-templates": 16,
};

const textareaClassName =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-[11px] text-slate-900 focus:border-slate-400 focus:outline-none";

export function StructureBulkImportForm() {
  const router = useRouter();
  const [importType, setImportType] =
    useState<StructureImportType>("circular-templates");
  const [pasteText, setPasteText] = useState("");
  const [previewRows, setPreviewRows] = useState<StructureImportRow[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [result, setResult] = useState<StructureImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const definition = getImportTypeDefinition(importType);
  const validCount = useMemo(
    () => previewRows.filter((row) => row.isValid).length,
    [previewRows],
  );
  const invalidCount = previewRows.length - validCount;

  function handleTypeChange(type: StructureImportType) {
    setImportType(type);
    setPreviewRows([]);
    setHasParsed(false);
    setResult(null);
    setErrorMessage(null);
  }

  function handleParsePreview() {
    const rows = parseStructureImportText(importType, pasteText);
    setPreviewRows(rows);
    setHasParsed(true);
    setResult(null);
    setErrorMessage(null);

    // Template types: resolve casting references server-side so bad names
    // surface in the preview instead of failing at import.
    const castingIndex = CASTING_COLUMN_INDEX[importType];
    if (castingIndex === undefined) {
      return;
    }
    const refs = rows
      .map((row) => (row.cells[castingIndex] ?? "").trim())
      .filter(Boolean);
    if (refs.length === 0) {
      return;
    }
    resolveCastingReferences(refs)
      .then((resolved) => {
        setPreviewRows((current) =>
          current.map((row) => {
            const ref = (row.cells[castingIndex] ?? "").trim();
            const match = ref ? resolved[ref] : undefined;
            if (!match || !("error" in match)) {
              return row;
            }
            return {
              ...row,
              issues: [...row.issues, match.error],
              isValid: false,
            };
          }),
        );
      })
      .catch(() => {
        // Preview enrichment only — import still validates castings.
      });
  }

  function handleLoadExample() {
    setPasteText(definition.example);
    setPreviewRows([]);
    setHasParsed(false);
    setResult(null);
  }

  function handleClear() {
    setPasteText("");
    setPreviewRows([]);
    setHasParsed(false);
    setResult(null);
    setErrorMessage(null);
  }

  function handleImport() {
    const validRows = previewRows.filter((row) => row.isValid);
    if (validRows.length === 0) {
      return;
    }

    const formData = new FormData();
    formData.set(
      "rows",
      JSON.stringify(
        validRows.map(({ lineNumber, cells }) => ({ lineNumber, cells })),
      ),
    );

    startTransition(async () => {
      try {
        setErrorMessage(null);
        let imported: StructureImportResult;
        if (importType === "rect-openings") {
          imported = await importRectOpenings(formData);
        } else if (importType === "pipe-openings") {
          imported = await importPipeOpenings(formData);
        } else {
          formData.set("type", importType);
          imported = await importStructureTemplates(formData);
        }
        setResult(imported);
        const summary = `${imported.created} created, ${imported.updated} updated`;
        if (imported.errors.length > 0) {
          toast.warning(
            `Imported with ${imported.errors.length} error${imported.errors.length === 1 ? "" : "s"} (${summary}).`,
          );
        } else {
          toast.success(`Import complete: ${summary}.`);
        }
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Import failed.",
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="What are you importing?"
        description="Pick a type, copy rows from Excel in the listed column order, then paste below."
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {STRUCTURE_IMPORT_TYPES.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => handleTypeChange(option.type)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                option.type === importType
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="block text-xs font-semibold">{option.label}</span>
              <span
                className={`mt-0.5 block text-[11px] ${
                  option.type === importType ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {option.columns.length} columns
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-700">
            Expected column order ({definition.label})
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {definition.columns.join(" → ")}
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            {definition.description}
          </p>
        </div>

        <div className="mt-4">
          <label
            htmlFor="structureBulkPaste"
            className="block text-xs font-medium text-slate-700"
          >
            Paste Excel rows (tab-separated)
          </label>
          <textarea
            id="structureBulkPaste"
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            rows={10}
            placeholder="Paste copied Excel rows here..."
            className={textareaClassName}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleParsePreview}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Parse Preview
          </button>
          <button
            type="button"
            onClick={handleLoadExample}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Load Example
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </SectionCard>

      {hasParsed ? (
        <SectionCard
          title="Import Preview"
          description={`${validCount} valid row${validCount === 1 ? "" : "s"}, ${invalidCount} with issues. Existing rows are updated in place; new rows are created.`}
          noPadding
        >
          {previewRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No rows found. Paste Excel data above and click Parse Preview.
            </p>
          ) : (
            <div className={tableFlushWrapperClassName}>
              <table className={tableClassName}>
                <thead>
                  <tr>
                    <th className={tableHeaderCellClassName}>Line</th>
                    <th className={tableHeaderCellClassName}>Status</th>
                    {definition.columns.map((column) => (
                      <th key={column} className={tableHeaderCellClassName}>
                        {column}
                      </th>
                    ))}
                    <th className={tableHeaderCellClassName}>Issues</th>
                  </tr>
                </thead>
                <tbody className={tableBodyClassName}>
                  {previewRows.map((row) => (
                    <tr key={row.lineNumber} className={tableRowClassName}>
                      <td className={`${tableCellClassName} text-slate-500`}>
                        {row.lineNumber}
                      </td>
                      <td className={tableCellClassName}>
                        <StatusBadge
                          label={row.isValid ? "Valid" : "Invalid"}
                          variant={row.isValid ? "success" : "danger"}
                        />
                      </td>
                      {definition.columns.map((column, index) => (
                        <td
                          key={column}
                          className={`${tableCellClassName} text-slate-600`}
                        >
                          {row.cells[index]?.trim() || "—"}
                        </td>
                      ))}
                      <td className={`${tableCellClassName} text-red-600`}>
                        {row.issues.length > 0 ? row.issues.join(" ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-slate-100 px-4 py-4">
            {errorMessage ? (
              <p className="mb-3 text-xs text-red-600">{errorMessage}</p>
            ) : null}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleImport}
                disabled={validCount === 0 || isPending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending
                  ? "Importing..."
                  : `Import ${validCount} Row${validCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {result ? (
        <SectionCard
          title="Import Result"
          description={`${result.created} created, ${result.updated} updated, ${result.errors.length} error${result.errors.length === 1 ? "" : "s"}`}
        >
          {result.errors.length === 0 && result.warnings.length === 0 ? (
            <p className="text-xs text-slate-600">
              All rows imported successfully.
            </p>
          ) : (
            <div className="space-y-2">
              {result.errors.map((item) => (
                <p key={`e-${item.line}-${item.message}`} className="text-xs text-red-600">
                  Line {item.line}: {item.message}
                </p>
              ))}
              {result.warnings.map((item) => (
                <p key={`w-${item.line}-${item.message}`} className="text-xs text-amber-600">
                  Line {item.line} (warning): {item.message}
                </p>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
