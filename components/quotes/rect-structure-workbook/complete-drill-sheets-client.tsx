"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type {
  RectSheetCastingOption,
  RectSheetOpeningSizeOption,
  RectSheetTemplateOption,
} from "@/components/drill-sheets/rect-sheet-form";
import { SectionCard } from "@/components/dashboard/section-card";
import { RectWorkbookGrid } from "@/components/quotes/rect-structure-workbook/rect-structure-workbook";
import { completeRectDrillSheets } from "@/app/quotes/structure-actions";
import {
  computeRectWorkbookRow,
  createDefaultRectDefaults,
  normalizeRectWorkbookRow,
  rectLineItemToWorkbookRow,
  upgradeRectRowToFull,
  type RectQuoteStructureConfig,
  type RectWorkbookOptions,
  type RectWorkbookRow,
} from "@/lib/quotes/rect-structure-workbook";

export type CompleteDrillSheetEntry = {
  jobStructureId: string;
  structureNumber: string;
  config: RectQuoteStructureConfig;
};

type CompleteDrillSheetsClientProps = {
  quoteId: string;
  returnPath: string;
  entries: CompleteDrillSheetEntry[];
  templates: RectSheetTemplateOption[];
  castings: RectSheetCastingOption[];
  openingSizes: RectSheetOpeningSizeOption[];
};

export function CompleteDrillSheetsClient({
  quoteId,
  returnPath,
  entries,
  templates,
  castings,
  openingSizes,
}: CompleteDrillSheetsClientProps) {
  const router = useRouter();
  const options: RectWorkbookOptions = useMemo(
    () => ({ templates, castings, openingSizes }),
    [templates, castings, openingSizes],
  );
  const defaults = useMemo(
    () => createDefaultRectDefaults(templates),
    [templates],
  );

  // One fixed row per placeholder, seeded from its quote config and expanded
  // to full detail (pipe list becomes opening rows, first at the low invert).
  // row.lineItemId carries the JobStructure id back to the save action.
  const [rows, setRows] = useState<RectWorkbookRow[]>(() =>
    entries
      .map((entry) =>
        rectLineItemToWorkbookRow({
          id: entry.jobStructureId,
          lineNumber: 0,
          type: "CONFIGURABLE_STRUCTURE",
          typeLabel: "",
          item: entry.structureNumber,
          description: "",
          qty: "1",
          unit: "EA",
          unitPrice: "0",
          weight: "",
          yards: "",
          taxable: true,
          rectStructureConfig: entry.config,
        }),
      )
      .filter((row): row is RectWorkbookRow => row != null)
      .map((row) =>
        computeRectWorkbookRow(
          upgradeRectRowToFull(normalizeRectWorkbookRow(row)),
          options,
          "FULL",
        ),
      ),
  );
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    error?: string;
    success?: string;
  } | null>(null);

  const readyRows = rows.filter(
    (row) => row.config?.detailLevel === "FULL" && row.lineItemId,
  );
  const notReadyRows = rows.filter(
    (row) => row.config?.detailLevel !== "FULL",
  );

  function handleCreate() {
    setMessage(null);
    const payload = readyRows.map((row) => ({
      jobStructureId: row.lineItemId!,
      structureNumber: row.structureNumber,
      config: row.config!,
    }));
    startTransition(async () => {
      try {
        const result = await completeRectDrillSheets(quoteId, payload);
        if (result.errors.length > 0) {
          setMessage({
            error: `${result.created} drill sheet${result.created === 1 ? "" : "s"} created; problems: ${result.errors.join(" · ")}`,
          });
          router.refresh();
          return;
        }
        if (result.created === rows.length) {
          // Everything completed — back to where the user came from.
          router.push(returnPath);
          return;
        }
        setMessage({
          success: `${result.created} drill sheet${result.created === 1 ? "" : "s"} created. ${rows.length - result.created} still need detail.`,
        });
        router.refresh();
      } catch (error) {
        setMessage({
          error:
            error instanceof Error
              ? error.message
              : "Could not create drill sheets.",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Complete Drill Sheets"
        description="Every structure below was quoted without drill-sheet detail. Fill in each opening's wall, invert, and placement — the quote's sizes, rims, and pipes are already entered — then create all the sheets at once."
      >
        <RectWorkbookGrid
          rows={rows}
          options={options}
          defaults={defaults}
          workbookMode="FULL"
          maxPickLbs={null}
          selectedRowIds={selectedRowIds}
          onRowsChange={(nextRows) => {
            setMessage(null);
            // Fixed row set: edits recompute, but rows can't be added/removed.
            setRows(
              nextRows.filter((row) =>
                rows.some((existing) => existing.id === row.id),
              ),
            );
          }}
          onSelectionChange={setSelectedRowIds}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-600">
            {readyRows.length} of {rows.length} structure
            {rows.length === 1 ? "" : "s"} ready
            {notReadyRows.length > 0
              ? ` — ${notReadyRows
                  .map((row) => row.structureNumber || "unnamed")
                  .join(", ")} still need${notReadyRows.length === 1 ? "s" : ""} openings or has issues (see row status)`
              : ""}
            .
          </p>
          <div className="flex gap-2">
            <Link
              href={returnPath}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={pending || readyRows.length === 0}
              onClick={handleCreate}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? "Creating…"
                : `Create ${readyRows.length} Drill Sheet${readyRows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
        {message?.error ? (
          <p className="mt-2 text-xs font-medium text-red-600">
            {message.error}
          </p>
        ) : null}
        {message?.success ? (
          <p className="mt-2 text-xs font-medium text-green-700">
            {message.success}
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}
