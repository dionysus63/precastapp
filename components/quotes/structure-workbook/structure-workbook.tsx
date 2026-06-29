"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import type { DrillSheetTemplateOption } from "@/components/drill-sheets/drill-sheet-form";
import { StructureWorkbookDefaultsPanel } from "@/components/quotes/structure-workbook/structure-workbook-defaults";
import type { EditableQuoteLineItem } from "@/lib/quotes/types";
import {
  applyDefaultsToBlankRow,
  commitAllWorkbookRowPrices,
  createDefaultWorkbookDefaults,
  createDefaultWorkbookRow,
  formatStructureNumber,
  lineItemToWorkbookRow,
  nextStructureNumber,
  readWorkbookSession,
  writeWorkbookApplyPayload,
  writeWorkbookSession,
  workbookRowToLineItem,
  type StructureWorkbookDefaults,
  type StructureWorkbookOptions,
  type StructureWorkbookRow,
} from "@/lib/quotes/structure-workbook";
import {
  createInitialWorkbookRows,
  StructureWorkbookGrid,
} from "@/components/quotes/structure-workbook/structure-workbook-grid";

type StructureWorkbookProps = {
  quoteId?: string;
  returnPath: string;
  initialLineItems: EditableQuoteLineItem[];
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
  returnPath,
  initialLineItems,
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
    return (
      session?.defaults ?? createDefaultWorkbookDefaults(templates)
    );
  });

  const [rows, setRows] = useState<StructureWorkbookRow[]>(() => {
    const session = readWorkbookSession(quoteId);
    const workbookDefaults =
      session?.defaults ?? createDefaultWorkbookDefaults(templates);
    if (session?.rows?.length) {
      return session.rows;
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

  useEffect(() => {
    setRows((current) =>
      current.map((row) =>
        row.structureConfig || row.status
          ? commitAllWorkbookRowPrices([row], options)[0]
          : row,
      ),
    );
  }, [options]);

  const persistSession = useCallback(
    (nextRows: StructureWorkbookRow[], nextDefaults?: StructureWorkbookDefaults) => {
      writeWorkbookSession(quoteId, {
        rows: nextRows,
        returnPath,
        pendingLineItems: null,
        defaults: nextDefaults ?? defaults,
      });
    },
    [quoteId, returnPath, defaults],
  );

  const handleRowsChange = (nextRows: StructureWorkbookRow[]) => {
    setDirty(true);
    setRows(nextRows);
    persistSession(nextRows);
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

  const handleApply = () => {
    const committed = commitAllWorkbookRowPrices(rows, options);
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
      returnPath,
    });

    persistSession(committed);
    router.push(returnPath);
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
    router.push(returnPath);
  };

  const pricedCount = rows.filter((row) => row.unitPrice != null).length;

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

      <SectionCard
        title="Circular Structure Workbook"
        description="Enter multiple circular structures at once. Use arrow keys or Tab to move between cells; prices calculate when you leave a cell. Paste rows from Excel (tab-separated)."
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
        </div>

        <StructureWorkbookGrid
          rows={rows}
          options={options}
          defaults={defaults}
          selectedRowIds={selectedRowIds}
          onRowsChange={handleRowsChange}
          onSelectionChange={setSelectedRowIds}
        />

        <p className="mt-2 text-[11px] text-slate-500">
          {pricedCount} of {rows.length} rows priced. Paste column order: Structure
          #, Template, Diameter, Casting ID, Rim, Low Invert, Material, Size,
          Type, Boots, Qty.
        </p>

        {error ? (
          <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
        ) : null}
      </SectionCard>

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
