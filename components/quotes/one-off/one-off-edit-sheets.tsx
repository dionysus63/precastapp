"use client";

import { useMemo, useState, useTransition } from "react";
import {
  bulkUpdateDrillSheets,
  bulkUpdateRectSheets,
  type BulkSheetRowResult,
} from "@/app/jobs/bulk-structure-actions";
import type { OneOffCreateResult } from "@/app/quotes/one-off-actions";
import {
  circularPayloadFromValues,
  rectPayloadFromValues,
} from "@/components/jobs/bulk-edit/bulk-edit-payloads";
import { OneOffGrid } from "@/components/quotes/one-off/one-off-grid";
import { OneOffResults } from "@/components/quotes/one-off/one-off-results";
import { SectionCard } from "@/components/dashboard/section-card";
import { describeActionFailure, isActionError } from "@/lib/action-result";
import { localTodayInput } from "@/lib/date-only";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import type { OneOffEditData, OneOffEditSheet } from "@/lib/quotes/one-off-edit";
import {
  circularPipeTypeChoices,
  computeCircularOneOffRow,
  computeRectOneOffRow,
  createEmptySetup,
  findDuplicateStructureNumbers,
  isRowChanged,
  mergeCircularRow,
  mergeRectRow,
  openingCountForRows,
  rectPipeTypeChoices,
  resizeRowOpenings,
  type OneOffCircularOptions,
  type OneOffRectOptions,
  type OneOffRow,
  type OneOffRowResult,
  type OneOffShape,
} from "@/lib/quotes/one-off-drill-sheets";

type Baseline<Values> = Map<string, OneOffEditSheet<Values>>;

function toBaseline<Values>(sheets: OneOffEditSheet<Values>[]): Baseline<Values> {
  return new Map(sheets.map((sheet) => [sheet.structureId, sheet]));
}

function paddedRows(sheets: OneOffEditSheet<unknown>[]) {
  const rows = sheets.map((sheet) => sheet.row);
  const openingCount = openingCountForRows(rows);
  return { rows: resizeRowOpenings(rows, openingCount), openingCount };
}

/**
 * Quotes → One-Off, edit mode: a job's saved drill sheets in the same grids
 * used to create them. Only changed rows are saved; everything the grid
 * doesn't show stays as it was on each sheet.
 */
export function OneOffEditSheets({
  data,
  circularOptions,
  rectOptions,
}: {
  data: OneOffEditData;
  circularOptions: OneOffCircularOptions;
  rectOptions: OneOffRectOptions;
}) {
  const [circularBaseline, setCircularBaseline] = useState(() =>
    toBaseline(data.circular),
  );
  const [rectBaseline, setRectBaseline] = useState(() => toBaseline(data.rect));
  const [circular, setCircular] = useState(() => paddedRows(data.circular));
  const [rect, setRect] = useState(() => paddedRows(data.rect));
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [result, setResult] = useState<OneOffCreateResult | null>(null);
  const [saving, startSaving] = useTransition();

  const circularPipeChoices = useMemo(
    () => circularPipeTypeChoices(circularOptions.pipeOpeningSizes),
    [circularOptions.pipeOpeningSizes],
  );
  const rectPipeChoices = useMemo(
    () => rectPipeTypeChoices(rectOptions.openingSizes),
    [rectOptions.openingSizes],
  );

  const circularResults = useMemo(
    () => circular.rows.map((row) => computeCircularOneOffRow(row, circularOptions)),
    [circular.rows, circularOptions],
  );
  const rectResults = useMemo(
    () => rect.rows.map((row) => computeRectOneOffRow(row, rectOptions)),
    [rect.rows, rectOptions],
  );

  const changedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of circular.rows) {
      const loaded = circularBaseline.get(row.id);
      if (loaded && isRowChanged(row, loaded.row)) ids.add(row.id);
    }
    for (const row of rect.rows) {
      const loaded = rectBaseline.get(row.id);
      if (loaded && isRowChanged(row, loaded.row)) ids.add(row.id);
    }
    return ids;
  }, [circular.rows, circularBaseline, rect.rows, rectBaseline]);

  /** Numbers used twice in the grids, or by another structure on the job. */
  const duplicateNumbers = useMemo(() => {
    const gridNumbers = [...circular.rows, ...rect.rows].map(
      (row) => row.structureNumber,
    );
    const keys = new Set(
      findDuplicateStructureNumbers(gridNumbers).map((number) =>
        number.toLowerCase(),
      ),
    );
    const others = new Set(
      data.otherNumbers.map((number) => number.trim().toLowerCase()),
    );
    for (const number of gridNumbers) {
      const key = number.trim().toLowerCase();
      if (key && others.has(key)) keys.add(key);
    }
    return keys;
  }, [circular.rows, data.otherNumbers, rect.rows]);

  useUnsavedChangesWarning(result == null && changedIds.size > 0);

  const changedNotReady = [
    ...circular.rows.filter(
      (row, index) => changedIds.has(row.id) && !circularResults[index].ready,
    ),
    ...rect.rows.filter(
      (row, index) => changedIds.has(row.id) && !rectResults[index].ready,
    ),
  ].length;
  const canSave =
    changedIds.size > 0 && changedNotReady === 0 && duplicateNumbers.size === 0;

  function handleSave() {
    if (!canSave) {
      return;
    }
    const today = localTodayInput();
    const errors = new Map<string, string>();

    const circularRows = circular.rows.filter((row) => changedIds.has(row.id));
    const circularMerged = circularRows.flatMap((row) => {
      const loaded = circularBaseline.get(row.id)!;
      const merged = mergeCircularRow(
        loaded.values,
        row,
        loaded.row,
        circularOptions.templates,
        today,
      );
      if ("error" in merged) {
        errors.set(row.id, merged.error);
        return [];
      }
      return [{ row, loaded, values: merged.values }];
    });
    const rectRows = rect.rows.filter((row) => changedIds.has(row.id));
    const rectMerged = rectRows.flatMap((row) => {
      const loaded = rectBaseline.get(row.id)!;
      const merged = mergeRectRow(
        loaded.values,
        row,
        loaded.row,
        rectOptions.templates,
        today,
      );
      if ("error" in merged) {
        errors.set(row.id, merged.error);
        return [];
      }
      return [{ row, loaded, values: merged.values }];
    });
    if (errors.size > 0) {
      setRowErrors(errors);
      setSaveError("Some changed rows can't be saved yet (see below).");
      return;
    }

    setSaveError(null);
    setRowErrors(new Map());
    startSaving(async () => {
      try {
        const circularSaved: BulkSheetRowResult[] = [];
        const rectSaved: BulkSheetRowResult[] = [];
        if (circularMerged.length > 0) {
          const response = await bulkUpdateDrillSheets(
            data.job.id,
            circularMerged.map((entry) => ({
              structureId: entry.row.id,
              expectedUpdatedAt: entry.loaded.updatedAt,
              payload: circularPayloadFromValues(entry.values),
            })),
          );
          if (isActionError(response)) {
            setSaveError(response.error);
            return;
          }
          circularSaved.push(...response);
        }
        if (rectMerged.length > 0) {
          const response = await bulkUpdateRectSheets(
            data.job.id,
            rectMerged.map((entry) => ({
              structureId: entry.row.id,
              expectedUpdatedAt: entry.loaded.updatedAt,
              payload: rectPayloadFromValues(entry.values),
            })),
          );
          if (isActionError(response)) {
            setSaveError(response.error);
            return;
          }
          rectSaved.push(...response);
        }

        // Saved rows become the new starting point for further edits.
        const nextCircular = new Map(circularBaseline);
        for (const entry of circularMerged) {
          const saved = circularSaved.find((r) => r.structureId === entry.row.id);
          if (saved?.ok) {
            nextCircular.set(entry.row.id, {
              structureId: entry.row.id,
              updatedAt: saved.updatedAt ?? entry.loaded.updatedAt,
              values: entry.values,
              row: entry.row,
            });
          }
        }
        const nextRect = new Map(rectBaseline);
        for (const entry of rectMerged) {
          const saved = rectSaved.find((r) => r.structureId === entry.row.id);
          if (saved?.ok) {
            nextRect.set(entry.row.id, {
              structureId: entry.row.id,
              updatedAt: saved.updatedAt ?? entry.loaded.updatedAt,
              values: entry.values,
              row: entry.row,
            });
          }
        }
        setCircularBaseline(nextCircular);
        setRectBaseline(nextRect);

        const failed = new Map<string, string>();
        for (const saved of [...circularSaved, ...rectSaved]) {
          if (!saved.ok) {
            failed.set(saved.structureId, saved.error ?? "Could not save.");
          }
        }
        if (failed.size > 0) {
          setRowErrors(failed);
          setSaveError(
            `${failed.size} row${failed.size === 1 ? "" : "s"} could not be saved (see below). The others were saved.`,
          );
          return;
        }

        setResult({
          jobId: data.job.id,
          jobNumber: data.job.jobNumber,
          projectName: data.job.projectName,
          jobCreated: false,
          folderCreated: true,
          errors: [],
          sheets: [
            ...circularMerged.map((entry) => ({
              id: entry.row.id,
              shape: "CIRCULAR" as const,
              structureNumber: entry.row.structureNumber.trim(),
              templateName: templateName("CIRCULAR", entry.row.templateId),
              wallHeightFeet: wallHeightFor("CIRCULAR", entry.row.id),
            })),
            ...rectMerged.map((entry) => ({
              id: entry.row.id,
              shape: "RECTANGULAR" as const,
              structureNumber: entry.row.structureNumber.trim(),
              templateName: templateName("RECTANGULAR", entry.row.templateId),
              wallHeightFeet: wallHeightFor("RECTANGULAR", entry.row.id),
            })),
          ],
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        setSaveError(
          describeActionFailure(error, "Could not save the drill sheets."),
        );
      }
    });
  }

  function templateName(shape: OneOffShape, templateId: string): string {
    const templates =
      shape === "CIRCULAR" ? circularOptions.templates : rectOptions.templates;
    return templates.find((entry) => entry.id === templateId)?.name ?? "";
  }

  function wallHeightFor(shape: OneOffShape, rowId: string): number | null {
    const rows = shape === "CIRCULAR" ? circular.rows : rect.rows;
    const results = shape === "CIRCULAR" ? circularResults : rectResults;
    return results[rows.findIndex((row) => row.id === rowId)]?.wallHeightFeet ?? null;
  }

  if (result) {
    return (
      <OneOffResults
        result={result}
        mode="updated"
        onStartOver={() => setResult(null)}
      />
    );
  }

  const totalRows = circular.rows.length + rect.rows.length;

  function renderGrid(shape: OneOffShape) {
    const isCircular = shape === "CIRCULAR";
    const section = isCircular ? circular : rect;
    const setSection = isCircular ? setCircular : setRect;
    const results: OneOffRowResult[] = isCircular ? circularResults : rectResults;
    if (section.rows.length === 0) {
      return null;
    }
    const withErrors = results.map((entry, index) => {
      const error = rowErrors.get(section.rows[index].id);
      return error ? { ...entry, ready: false, status: error } : entry;
    });
    return (
      <SectionCard
        title={isCircular ? "Circular Drill Sheets" : "Rectangular Drill Sheets"}
        description={`${section.rows.length} sheet${section.rows.length === 1 ? "" : "s"}. Changed rows are highlighted.`}
      >
        <OneOffGrid
          shape={shape}
          rows={section.rows}
          results={withErrors}
          openingCount={section.openingCount}
          setup={createEmptySetup(shape)}
          pipeChoices={isCircular ? circularPipeChoices : rectPipeChoices}
          takenNumbers={data.otherNumbers}
          duplicateNumbers={duplicateNumbers}
          circularOptions={circularOptions}
          rectOptions={rectOptions}
          editMode
          changedRowIds={changedIds}
          onRowsChange={(rows: OneOffRow[]) =>
            setSection((current) => ({ ...current, rows }))
          }
          onOpeningCountChange={(openingCount) =>
            setSection((current) => ({ ...current, openingCount }))
          }
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {totalRows === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          There are no drill sheets on this job that can be edited here.
        </p>
      ) : null}

      {renderGrid("CIRCULAR")}
      {renderGrid("RECTANGULAR")}

      {data.notEditable.length > 0 ? (
        <details className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-slate-700">
            {data.notEditable.length} structure
            {data.notEditable.length === 1 ? " isn't" : "s aren't"} shown here
          </summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {data.notEditable.map((entry, index) => (
              <li key={`${entry.label}-${index}`}>
                {entry.label}: {entry.reason}
              </li>
            ))}
          </ul>
          <p className="mt-2">Open those from the job page to edit them.</p>
        </details>
      ) : null}

      {totalRows > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : `Save Changes${changedIds.size > 0 ? ` (${changedIds.size})` : ""}`}
          </button>
          <span className="text-xs text-slate-500">
            {changedIds.size === 0
              ? "Change a cell to edit that sheet."
              : duplicateNumbers.size > 0
                ? "Fix the structure numbers marked in red."
                : changedNotReady > 0
                  ? `${changedNotReady} changed row${changedNotReady === 1 ? "" : "s"} still need${changedNotReady === 1 ? "s" : ""} attention (see Status).`
                  : "Only the highlighted rows are saved."}
          </span>
          {saveError ? (
            <p className="w-full text-xs text-red-600">{saveError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
