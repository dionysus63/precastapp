"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlanSheetRecord } from "@/app/quotes/plan-sheet-actions";
import { savePlanSheetMarkup } from "@/app/quotes/plan-sheet-actions";
import { SectionCard } from "@/components/dashboard/section-card";
import type { DrillSheetTemplateOption } from "@/components/drill-sheets/drill-sheet-form";
import { StructureWorkbookDefaultsPanel } from "@/components/quotes/structure-workbook/structure-workbook-defaults";
import { StructureWorkbookPlanPicker } from "@/components/quotes/structure-workbook/structure-workbook-plan-picker";
import { StructureWorkbookPlanTakeoff } from "@/components/quotes/structure-workbook/structure-workbook-plan-takeoff";
import type { EditableQuoteLineItem } from "@/lib/quotes/types";
import {
  EMPTY_PLAN_SHEET_MARKUP,
  pruneMarkupForRows,
  rekeyPlanSheetMarkup,
  type PlanSheetMarkup,
} from "@/lib/quotes/plan-sheet-markup";
import {
  applyDefaultsToBlankRow,
  commitAllWorkbookRowPrices,
  createDefaultWorkbookDefaults,
  createDefaultWorkbookRow,
  formatStructureNumber,
  lineItemToWorkbookRow,
  nextStructureNumber,
  normalizeWorkbookRow,
  readWorkbookSession,
  upgradeRowToFullDetail,
  writeWorkbookApplyPayload,
  writeWorkbookSession,
  workbookRowToLineItem,
  type StructureWorkbookDefaults,
  type StructureWorkbookOptions,
  type StructureWorkbookRow,
  type WorkbookMode,
} from "@/lib/quotes/structure-workbook";
import { formatQuoteCurrency } from "@/components/quotes/quote-utils";
import {
  createInitialWorkbookRows,
  StructureWorkbookGrid,
} from "@/components/quotes/structure-workbook/structure-workbook-grid";

type StructureWorkbookProps = {
  quoteId?: string;
  jobId?: string | null;
  returnPath: string;
  initialLineItems: EditableQuoteLineItem[];
  initialPlanSheet?: PlanSheetRecord | null;
  templates: DrillSheetTemplateOption[];
  castings: StructureWorkbookOptions["castings"];
  pipeOpeningSizes: StructureWorkbookOptions["pipeOpeningSizes"];
  diameterConfigs: StructureWorkbookOptions["diameterConfigs"];
};

function rowsFromLineItems(
  lineItems: EditableQuoteLineItem[],
  templates: DrillSheetTemplateOption[],
  defaults: StructureWorkbookDefaults,
): StructureWorkbookRow[] {
  const workbookLines = lineItems.filter(
    (line) => line.type === "CONFIGURABLE_STRUCTURE" && line.structureConfig,
  );
  if (workbookLines.length === 0) {
    return createInitialWorkbookRows(templates, 5, defaults);
  }
  return workbookLines.map((line) => lineItemToWorkbookRow(line, templates));
}

export function StructureWorkbook({
  quoteId,
  jobId,
  returnPath,
  initialLineItems,
  initialPlanSheet = null,
  templates,
  castings,
  pipeOpeningSizes,
  diameterConfigs,
}: StructureWorkbookProps) {
  const router = useRouter();
  const options: StructureWorkbookOptions = useMemo(
    () => ({ templates, castings, pipeOpeningSizes, diameterConfigs }),
    [templates, castings, pipeOpeningSizes, diameterConfigs],
  );

  const [defaults, setDefaults] = useState<StructureWorkbookDefaults>(() => {
    const session = readWorkbookSession(quoteId);
    // Older sessions stored a pipeType default that no longer exists; merging
    // onto fresh defaults keeps the shape complete either way.
    return {
      ...createDefaultWorkbookDefaults(templates),
      ...(session?.defaults ?? {}),
    };
  });

  const [workbookMode, setWorkbookMode] = useState<WorkbookMode>(() => {
    const session = readWorkbookSession(quoteId);
    return session?.workbookMode ?? "QUOTE";
  });

  const [viewMode, setViewMode] = useState<"grid" | "takeoff">(() => {
    const session = readWorkbookSession(quoteId);
    return session?.viewMode ?? "grid";
  });

  const [planSheet, setPlanSheet] = useState<PlanSheetRecord | null>(() => {
    if (initialPlanSheet) {
      return initialPlanSheet;
    }
    const session = readWorkbookSession(quoteId);
    if (session?.planSheetId && session.planMarkup) {
      return {
        id: session.planSheetId,
        quoteId: quoteId ?? null,
        jobId: jobId ?? null,
        sourceType: "UPLOAD",
        filePath: "",
        originalName: "Plan sheet",
        pageNumber: 1,
        markup: session.planMarkup,
      };
    }
    return null;
  });

  const [markup, setMarkup] = useState<PlanSheetMarkup>(() => {
    if (initialPlanSheet?.markup) {
      return initialPlanSheet.markup;
    }
    const session = readWorkbookSession(quoteId);
    if (session?.planMarkup) {
      return session.planMarkup;
    }
    return { ...EMPTY_PLAN_SHEET_MARKUP };
  });

  const [planPageNumber, setPlanPageNumber] = useState(
    () => initialPlanSheet?.pageNumber ?? 1,
  );
  const [pendingPlaceRowId, setPendingPlaceRowId] = useState<string | null>(null);
  const markupSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didRekeyMarkup = useRef(false);

  const [rows, setRows] = useState<StructureWorkbookRow[]>(() => {
    const session = readWorkbookSession(quoteId);
    const workbookDefaults =
      session?.defaults ?? createDefaultWorkbookDefaults(templates);
    if (session?.rows?.length) {
      return session.rows.map(normalizeWorkbookRow);
    }
    const sourceLineItems =
      session?.pendingLineItems?.length
        ? session.pendingLineItems
        : initialLineItems;
    return rowsFromLineItems(sourceLineItems, templates, workbookDefaults);
  });
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-price previously entered rows whenever fresh pricing data arrives
  // (options identity changes after a server refresh). Adjusting state during
  // render avoids the extra paint an effect would cause.
  const [pricedFor, setPricedFor] = useState<{
    options: StructureWorkbookOptions;
    mode: WorkbookMode;
  } | null>(null);
  if (pricedFor?.options !== options || pricedFor?.mode !== workbookMode) {
    setPricedFor({ options, mode: workbookMode });
    setRows((current) =>
      current.map((row) =>
        row.structureConfig || row.status
          ? commitAllWorkbookRowPrices([row], options, workbookMode)[0]
          : row,
      ),
    );
  }

  const persistSession = useCallback(
    (
      nextRows: StructureWorkbookRow[],
      nextDefaults?: StructureWorkbookDefaults,
      nextMode?: WorkbookMode,
      nextViewMode?: "grid" | "takeoff",
      nextPlanSheetId?: string | null,
      nextMarkup?: PlanSheetMarkup,
    ) => {
      const existing = readWorkbookSession(quoteId);
      writeWorkbookSession(quoteId, {
        rows: nextRows,
        returnPath: existing?.returnPath ?? returnPath,
        pendingLineItems: null,
        pendingFormState: existing?.pendingFormState ?? null,
        defaults: nextDefaults ?? defaults,
        workbookMode: nextMode ?? workbookMode,
        viewMode: nextViewMode ?? viewMode,
        planSheetId: nextPlanSheetId ?? planSheet?.id ?? null,
        planMarkup: nextMarkup ?? markup,
      });
    },
    [quoteId, returnPath, defaults, workbookMode, viewMode, planSheet?.id, markup],
  );

  const scheduleMarkupSave = useCallback(
    (nextMarkup: PlanSheetMarkup, planSheetId: string) => {
      if (markupSaveTimer.current) {
        clearTimeout(markupSaveTimer.current);
      }
      markupSaveTimer.current = setTimeout(() => {
        void savePlanSheetMarkup(planSheetId, nextMarkup).catch(() => {
          // Session copy remains; user can retry by editing markup again.
        });
      }, 800);
    },
    [],
  );

  const handleMarkupChange = useCallback(
    (nextMarkup: PlanSheetMarkup) => {
      setDirty(true);
      setMarkup(nextMarkup);
      persistSession(rows, defaults, workbookMode, viewMode, planSheet?.id, nextMarkup);
      if (planSheet?.id) {
        scheduleMarkupSave(nextMarkup, planSheet.id);
      }
    },
    [
      defaults,
      persistSession,
      planSheet?.id,
      rows,
      scheduleMarkupSave,
      viewMode,
      workbookMode,
    ],
  );

  const handlePlanSheetReady = useCallback(
    (nextPlanSheet: PlanSheetRecord) => {
      setDirty(true);
      setPlanSheet(nextPlanSheet);
      setMarkup(nextPlanSheet.markup);
      setPlanPageNumber(nextPlanSheet.pageNumber);
      persistSession(
        rows,
        defaults,
        "DRILL_SHEET",
        "takeoff",
        nextPlanSheet.id,
        nextPlanSheet.markup,
      );
      setWorkbookMode("DRILL_SHEET");
      setViewMode("takeoff");
    },
    [defaults, persistSession, rows],
  );

  const handleViewModeChange = useCallback(
    (mode: "grid" | "takeoff") => {
      setViewMode(mode);
      if (mode === "takeoff" && workbookMode !== "DRILL_SHEET") {
        setDirty(true);
        setWorkbookMode("DRILL_SHEET");
        const nextRows = rows.map((row) => {
          const upgraded = upgradeRowToFullDetail(row);
          return commitAllWorkbookRowPrices([upgraded], options, "DRILL_SHEET")[0];
        });
        setRows(nextRows);
        persistSession(nextRows, defaults, "DRILL_SHEET", mode);
        return;
      }
      persistSession(rows, defaults, workbookMode, mode);
    },
    [defaults, options, persistSession, rows, workbookMode],
  );

  const handleRowsChange = (nextRows: StructureWorkbookRow[]) => {
    setDirty(true);
    const prunedMarkup = pruneMarkupForRows(
      markup,
      new Set(nextRows.map((row) => row.id)),
    );
    if (prunedMarkup.structures.length !== markup.structures.length) {
      setMarkup(prunedMarkup);
      if (planSheet?.id) {
        scheduleMarkupSave(prunedMarkup, planSheet.id);
      }
    }
    setRows(nextRows);
    persistSession(
      nextRows,
      defaults,
      workbookMode,
      viewMode,
      planSheet?.id,
      prunedMarkup,
    );
  };

  const handleDefaultsChange = (nextDefaults: StructureWorkbookDefaults) => {
    setDirty(true);
    setDefaults(nextDefaults);
    persistSession(rows, nextDefaults);
  };

  const addRows = (count: number) => {
    const additions = Array.from({ length: count }, () =>
      createDefaultWorkbookRow(templates, rows, defaults),
    );
    handleRowsChange([...rows, ...additions]);
  };

  const duplicateSelected = () => {
    if (selectedRowIds.size === 0) {
      return;
    }
    const duplicates = rows
      .filter((row) => selectedRowIds.has(row.id))
      .map((row) => ({
        ...row,
        id: `${row.id}-copy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        lineItemId: undefined,
        structureNumber: "",
        wallHeightFeet: null,
        unitPrice: null,
        status: "",
        structureConfig: null,
      }))
      .map((row, index) => {
        const prefix = defaults.namePrefix;
        const base = nextStructureNumber(rows, defaults);
        return {
          ...row,
          structureNumber: formatStructureNumber(prefix, base + index),
        };
      });
    handleRowsChange([...rows, ...duplicates]);
  };

  const applyDefaultsToSelected = () => {
    if (selectedRowIds.size === 0) {
      return;
    }
    let nameCounter = nextStructureNumber(rows, defaults);
    const next = rows.map((row) => {
      if (!selectedRowIds.has(row.id)) {
        return row;
      }
      let patched = applyDefaultsToBlankRow(row, defaults);
      if (!row.structureNumber.trim()) {
        patched = {
          ...patched,
          structureNumber: formatStructureNumber(
            defaults.namePrefix,
            nameCounter,
          ),
        };
        nameCounter += 1;
      }
      return patched;
    });
    handleRowsChange(next);
  };

  const removeSelected = () => {
    if (selectedRowIds.size === 0) {
      return;
    }
    handleRowsChange(rows.filter((row) => !selectedRowIds.has(row.id)));
    setSelectedRowIds(new Set());
  };

  useEffect(() => {
    if (didRekeyMarkup.current) {
      return;
    }
    if (!initialPlanSheet && !readWorkbookSession(quoteId)?.planSheetId) {
      return;
    }
    didRekeyMarkup.current = true;
    setMarkup((current) => {
      const rekeyed = rekeyPlanSheetMarkup(current, rows);
      if (planSheet?.id) {
        scheduleMarkupSave(rekeyed, planSheet.id);
      }
      return rekeyed;
    });
  }, [initialPlanSheet, planSheet?.id, quoteId, rows, scheduleMarkupSave]);

  useEffect(() => {
    return () => {
      if (markupSaveTimer.current) {
        clearTimeout(markupSaveTimer.current);
      }
    };
  }, []);

  const handleModeChange = (mode: WorkbookMode) => {
    setDirty(true);
    setWorkbookMode(mode);

    if (mode === "DRILL_SHEET") {
      const nextRows = rows.map((row) => {
        const upgraded = upgradeRowToFullDetail(row);
        return commitAllWorkbookRowPrices([upgraded], options, mode)[0];
      });
      setRows(nextRows);
      persistSession(nextRows, defaults, mode);
      return;
    }

    persistSession(rows, defaults, mode);
  };

  const removeEmptyRows = () => {
    const next = rows.filter(
      (row) =>
        row.rimElevation.trim() !== "" ||
        row.lowInvertElevation.trim() !== "" ||
        row.structureConfig != null,
    );
    if (next.length === rows.length) {
      return;
    }
    handleRowsChange(next);
    setSelectedRowIds(new Set());
  };

  const effectiveReturnPath =
    readWorkbookSession(quoteId)?.returnPath ?? returnPath;

  const handleApply = () => {
    const committed = commitAllWorkbookRowPrices(rows, options, workbookMode);
    setRows(committed);
    persistSession(committed);

    const validRows = committed.filter(
      (row) => row.structureConfig && row.unitPrice != null,
    );

    if (validRows.length === 0) {
      setError(
        "Enter at least one structure with rim, low invert, and valid pricing.",
      );
      return;
    }

    const workbookLineItems = validRows
      .map((row, index) =>
        workbookRowToLineItem(row, index + 1, row.lineItemId),
      )
      .filter((line): line is EditableQuoteLineItem => line != null);

    writeWorkbookApplyPayload(quoteId, {
      lineItems: workbookLineItems,
      returnPath: effectiveReturnPath,
      planSheetId: planSheet?.id ?? null,
    });

    if (planSheet?.id) {
      void savePlanSheetMarkup(planSheet.id, markup);
    }

    persistSession(committed);
    router.push(effectiveReturnPath);
  };

  const handleCancel = () => {
    if (
      dirty &&
      !window.confirm(
        "Discard unsaved workbook changes and return to the quote?",
      )
    ) {
      return;
    }
    router.push(effectiveReturnPath);
  };

  const pricedCount = rows.filter((row) => row.unitPrice != null).length;
  const pricedTotal = rows.reduce((sum, row) => {
    if (row.unitPrice == null) {
      return sum;
    }
    const qty = Number(row.qty);
    return sum + row.unitPrice * (Number.isFinite(qty) && qty > 0 ? qty : 1);
  }, 0);

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No active circular templates yet. Create one in{" "}
        <Link href="/structures" className="font-semibold underline">
          Structures
        </Link>{" "}
        first.
      </div>
    );
  }

  if (diameterConfigs.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No diameter configurations yet. Add them in{" "}
        <Link href="/settings/diameters" className="font-semibold underline">
          Settings → Structure Diameters
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StructureWorkbookDefaultsPanel
        defaults={defaults}
        options={options}
        onChange={handleDefaultsChange}
        onApplyToSelected={applyDefaultsToSelected}
        selectedCount={selectedRowIds.size}
      />

      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Workbook view</p>
        <p className="mt-1 text-xs text-slate-600">
          Enter structures in the grid or place them on a construction plan.
          Plan takeoff uses full drill sheet detail (openings and angles).
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-slate-200 p-1">
          <button
            type="button"
            onClick={() => handleViewModeChange("grid")}
            className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${
              viewMode === "grid"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            Grid entry
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange("takeoff")}
            className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${
              viewMode === "takeoff"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            Plan takeoff
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Entry mode</p>
        <p className="mt-1 text-xs text-slate-600">
          Choose quote-only for fast pricing, or full drill sheet detail when
          you already know all openings. Quote-only rows can be upgraded later
          in this workbook.
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-slate-200 p-1">
          <button
            type="button"
            onClick={() => handleModeChange("QUOTE")}
            className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${
              workbookMode === "QUOTE"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            Quote only
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("DRILL_SHEET")}
            className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${
              workbookMode === "DRILL_SHEET"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            Full drill sheet
          </button>
        </div>
      </div>
      ) : null}

      {viewMode === "takeoff" ? (
        planSheet ? (
          <StructureWorkbookPlanTakeoff
            planSheetId={planSheet.id}
            planName={planSheet.originalName}
            pageNumber={planPageNumber}
            onPageChange={setPlanPageNumber}
            markup={markup}
            onMarkupChange={handleMarkupChange}
            rows={rows}
            onRowsChange={handleRowsChange}
            options={options}
            defaults={defaults}
            templates={templates}
            pendingPlaceRowId={pendingPlaceRowId}
            onPendingPlaceRowIdChange={setPendingPlaceRowId}
          />
        ) : (
          <StructureWorkbookPlanPicker
            quoteId={quoteId}
            jobId={jobId ?? readWorkbookSession(quoteId)?.pendingFormState?.jobId}
            onPlanSheetReady={handlePlanSheetReady}
          />
        )
      ) : (
      <SectionCard
        title="Circular Structure Workbook"
        description={
          workbookMode === "DRILL_SHEET"
            ? "Enter structures with full opening detail. Each structure's openings sit directly under its row. Drill sheets can be created from the quote later."
            : "Enter multiple circular structures at once. Use arrow keys or Tab to move between cells; prices calculate when you leave a cell. Each structure's pipes sit directly under its row. Paste rows from Excel (tab-separated)."
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addRows(1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Add 1 row
          </button>
          <button
            type="button"
            onClick={() => addRows(5)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Add 5 rows
          </button>
          <button
            type="button"
            onClick={() => addRows(10)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Add 10 rows
          </button>
          <button
            type="button"
            onClick={duplicateSelected}
            disabled={selectedRowIds.size === 0}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Duplicate selected
          </button>
          <button
            type="button"
            onClick={removeSelected}
            disabled={selectedRowIds.size === 0}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            Remove selected
          </button>
          <button
            type="button"
            onClick={removeEmptyRows}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Remove empty rows
          </button>
        </div>

        <StructureWorkbookGrid
          rows={rows}
          options={options}
          defaults={defaults}
          workbookMode={workbookMode}
          selectedRowIds={selectedRowIds}
          onRowsChange={handleRowsChange}
          onSelectionChange={setSelectedRowIds}
        />

        <p className="mt-2 text-[11px] text-slate-500">
          {pricedCount} of {rows.length} rows priced
          {pricedCount > 0
            ? ` — extended total ${formatQuoteCurrency(pricedTotal)}`
            : ""}
          .
          {workbookMode === "QUOTE"
            ? " Add pipe sizes in the band under each row; boot count and pricing update automatically. Paste column order: Structure #, Template, Diameter, Casting ID, Rim, Low Invert, Material, Size, Count, Qty."
            : " Enter openings in the band under each row; low invert and boot count are derived automatically."}
        </p>

        {error ? (
          <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
        ) : null}
      </SectionCard>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleApply}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Apply to Quote
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
