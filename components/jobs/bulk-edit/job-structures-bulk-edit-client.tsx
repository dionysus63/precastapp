"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type {
  BulkSheetRowInput,
  BulkSheetRowResult,
} from "@/app/jobs/bulk-structure-actions";
import {
  bulkUpdateDrillSheets,
  bulkUpdateRectSheets,
} from "@/app/jobs/bulk-structure-actions";
import type { RectSheetFormValues } from "@/components/drill-sheets/rect-sheet-form";
import type { DrillSheetFormValues } from "@/lib/drill-sheet-detail";
import type {
  CircularBulkEditRow,
  JobStructuresBulkEditData,
  RectBulkEditRow,
} from "@/lib/job-structures-bulk-edit";
import {
  CircularBulkGrid,
  type CircularGridOptions,
} from "@/components/jobs/bulk-edit/circular-bulk-grid";
import {
  RectBulkGrid,
  type RectGridOptions,
} from "@/components/jobs/bulk-edit/rect-bulk-grid";

type Tab = "circular" | "rect";

type JobStructuresBulkEditClientProps = {
  jobId: string;
  data: JobStructuresBulkEditData;
  circularOptions: CircularGridOptions;
  rectOptions: RectGridOptions;
};

import {
  circularPayloadFromValues,
  rectPayloadFromValues,
} from "@/components/jobs/bulk-edit/bulk-edit-payloads";

const tabButtonClassName = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-xs font-semibold ${
    active
      ? "bg-slate-900 text-white"
      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
  }`;

export function JobStructuresBulkEditClient({
  jobId,
  data,
  circularOptions,
  rectOptions,
}: JobStructuresBulkEditClientProps) {
  const [tab, setTab] = useState<Tab>(
    data.circular.length === 0 && data.rect.length > 0 ? "rect" : "circular",
  );
  const [circularRows, setCircularRows] = useState<CircularBulkEditRow[]>(
    data.circular,
  );
  const [rectRows, setRectRows] = useState<RectBulkEditRow[]>(data.rect);
  // Serialized baseline per structure; a row is dirty when it differs.
  const [baselines, setBaselines] = useState<Map<string, string>>(
    () =>
      new Map([
        ...data.circular.map(
          (row) => [row.structureId, JSON.stringify(row.values)] as const,
        ),
        ...data.rect.map(
          (row) => [row.structureId, JSON.stringify(row.values)] as const,
        ),
      ]),
  );
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map());
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();

  const dirtyCircular = useMemo(
    () =>
      circularRows.filter(
        (row) => JSON.stringify(row.values) !== baselines.get(row.structureId),
      ),
    [circularRows, baselines],
  );
  const dirtyRect = useMemo(
    () =>
      rectRows.filter(
        (row) => JSON.stringify(row.values) !== baselines.get(row.structureId),
      ),
    [rectRows, baselines],
  );
  const dirtyIds = useMemo(
    () =>
      new Set([
        ...dirtyCircular.map((row) => row.structureId),
        ...dirtyRect.map((row) => row.structureId),
      ]),
    [dirtyCircular, dirtyRect],
  );
  const dirtyCount = dirtyIds.size;

  const applyResults = (
    results: BulkSheetRowResult[],
    labelFor: (structureId: string) => string,
  ) => {
    const errors = new Map<string, string>();
    // New updatedAt baselines for saved rows; error text for failed ones.
    const okIds = new Set(
      results.filter((entry) => entry.ok).map((entry) => entry.structureId),
    );
    const updatedAtById = new Map(
      results
        .filter((entry) => entry.ok && entry.updatedAt)
        .map((entry) => [entry.structureId, entry.updatedAt!] as const),
    );
    setCircularRows((rows) =>
      rows.map((row) =>
        okIds.has(row.structureId)
          ? {
              ...row,
              updatedAt: updatedAtById.get(row.structureId) ?? row.updatedAt,
            }
          : row,
      ),
    );
    setRectRows((rows) =>
      rows.map((row) =>
        okIds.has(row.structureId)
          ? {
              ...row,
              updatedAt: updatedAtById.get(row.structureId) ?? row.updatedAt,
            }
          : row,
      ),
    );
    for (const result of results) {
      if (!result.ok) {
        errors.set(
          result.structureId,
          `${labelFor(result.structureId)}: ${result.error ?? "Could not save."}`,
        );
      }
    }
    return { errors };
  };

  const handleSave = () => {
    const producedDirty = [
      ...dirtyCircular.filter((row) => row.isProduced),
      ...dirtyRect.filter((row) => row.isProduced),
    ];
    if (producedDirty.length > 0) {
      const names = producedDirty
        .map((row) =>
          "manholeNumber" in row.values
            ? row.values.manholeNumber
            : row.values.structureNumber,
        )
        .map((name) => name || "(unnumbered)")
        .join(", ");
      const confirmed = window.confirm(
        `These structures are already made or shipped: ${names}.\n\nSaving changes their sheet numbers anyway. Continue?`,
      );
      if (!confirmed) {
        return;
      }
    }

    setMessage(null);
    startTransition(async () => {
      const circularInputs: BulkSheetRowInput[] = dirtyCircular.map((row) => ({
        structureId: row.structureId,
        expectedUpdatedAt: row.updatedAt,
        payload: circularPayloadFromValues(row.values),
      }));
      const rectInputs: BulkSheetRowInput[] = dirtyRect.map((row) => ({
        structureId: row.structureId,
        expectedUpdatedAt: row.updatedAt,
        payload: rectPayloadFromValues(row.values),
      }));

      try {
        const [circularResults, rectResults] = await Promise.all([
          circularInputs.length > 0
            ? bulkUpdateDrillSheets(jobId, circularInputs)
            : Promise.resolve<BulkSheetRowResult[]>([]),
          rectInputs.length > 0
            ? bulkUpdateRectSheets(jobId, rectInputs)
            : Promise.resolve<BulkSheetRowResult[]>([]),
        ]);

        const labelFor = (structureId: string) => {
          const circularRow = circularRows.find(
            (row) => row.structureId === structureId,
          );
          if (circularRow) {
            return circularRow.values.manholeNumber || "(unnumbered)";
          }
          const rectRow = rectRows.find(
            (row) => row.structureId === structureId,
          );
          return rectRow?.values.structureNumber || "(unnumbered)";
        };

        const allResults = [...circularResults, ...rectResults];
        const { errors } = applyResults(allResults, labelFor);
        const okIds = allResults
          .filter((entry) => entry.ok)
          .map((entry) => entry.structureId);

        // Saved rows become the new baseline; failed rows stay dirty.
        setBaselines((prev) => {
          const next = new Map(prev);
          for (const id of okIds) {
            const row =
              circularRows.find((entry) => entry.structureId === id) ??
              rectRows.find((entry) => entry.structureId === id);
            if (row) {
              next.set(id, JSON.stringify(row.values));
            }
          }
          return next;
        });
        setRowErrors(errors);
        setMessage(
          errors.size > 0
            ? `Saved ${okIds.length} of ${allResults.length} changed structures — fix the highlighted rows and save again.`
            : `Saved ${okIds.length} structure${okIds.length === 1 ? "" : "s"}.`,
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not save the changes.",
        );
      }
    });
  };

  const handleCircularChange = (
    structureId: string,
    values: DrillSheetFormValues,
  ) => {
    setCircularRows((rows) =>
      rows.map((row) =>
        row.structureId === structureId ? { ...row, values } : row,
      ),
    );
  };

  const handleRectChange = (
    structureId: string,
    values: RectSheetFormValues,
  ) => {
    setRectRows((rows) =>
      rows.map((row) =>
        row.structureId === structureId ? { ...row, values } : row,
      ),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("circular")}
            className={tabButtonClassName(tab === "circular")}
          >
            Circular ({circularRows.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("rect")}
            className={tabButtonClassName(tab === "rect")}
          >
            Rect ({rectRows.length})
          </button>
        </div>
        <div className="flex items-center gap-3">
          {message ? (
            <p className="text-[11px] text-slate-600">{message}</p>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || dirtyCount === 0}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {saving
              ? "Saving…"
              : dirtyCount > 0
                ? `Save ${dirtyCount} changed`
                : "No changes"}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        Enter moves down a column, Ctrl+D fills a cell from the row above, and
        gray columns recompute as you type. Rows turn blue until saved.
      </p>

      {tab === "circular" ? (
        circularRows.length > 0 ? (
          <CircularBulkGrid
            rows={circularRows}
            options={circularOptions}
            dirtyIds={dirtyIds}
            rowErrors={rowErrors}
            onValuesChange={handleCircularChange}
          />
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
            No circular structures with completed drill sheets on this job.
          </p>
        )
      ) : rectRows.length > 0 ? (
        <RectBulkGrid
          rows={rectRows}
          options={rectOptions}
          dirtyIds={dirtyIds}
          rowErrors={rowErrors}
          onValuesChange={handleRectChange}
        />
      ) : (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          No rectangular structures with completed sheets on this job.
        </p>
      )}

      {data.skipped.length > 0 ? (
        <p className="text-[11px] text-slate-500">
          Not editable here (no completed sheet):{" "}
          {data.skipped.map((entry, index) => (
            <span key={entry.structureId}>
              {index > 0 ? ", " : ""}
              <Link
                href={`/jobs/${jobId}/structures/${entry.structureId}`}
                className="text-sky-600 hover:underline"
              >
                {entry.label}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
