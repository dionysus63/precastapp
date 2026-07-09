"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  RectSheetCastingOption,
  RectSheetTemplateOption,
} from "@/components/drill-sheets/rect-sheet-form";
import { SectionCard } from "@/components/dashboard/section-card";
import { structureInputClassName } from "@/components/structures/structure-utils";
import { formatQuoteCurrency } from "@/components/quotes/quote-utils";
import { formatPounds, RECT_WALL_LABELS, type RectOpeningPlacement, type RectWall } from "@/lib/rect-structure";
import {
  parseTsvPaste,
  readWorkbookSession,
  writeWorkbookApplyPayload,
} from "@/lib/quotes/structure-workbook";
import {
  applyRectTsvToRows,
  buildRectApplyLineItems,
  computeRectWorkbookRow,
  createDefaultRectDefaults,
  createDefaultRectRow,
  createRectOpeningRow,
  duplicateRectRow,
  normalizeRectWorkbookRow,
  readRectWorkbookSession,
  rectLineItemToWorkbookRow,
  rectWorkbookRowToLineItem,
  upgradeRectRowToFull,
  writeRectWorkbookSession,
  type RectWorkbookDefaults,
  type RectWorkbookMode,
  type RectWorkbookOpeningRow,
  type RectWorkbookOptions,
  type RectWorkbookRow,
} from "@/lib/quotes/rect-structure-workbook";
import type { EditableQuoteLineItem } from "@/lib/quotes/types";
import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellInputClassName,
  tableClassName,
  tableGridCellClassName,
  tableHeaderCellClassName,
  tableInlineInputClassName,
  tableWrapperClassName,
} from "@/lib/table-styles";

const WALL_OPTIONS: RectWall[] = ["UP", "DOWN", "LEFT", "RIGHT"];

/** Slab configuration encoded for a single compact grid cell. */
const SLAB_CHOICES: {
  value: string;
  label: string;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  baseAttached: boolean;
}[] = [
  { value: "TB_A", label: "Top + Base", hasTopSlab: true, hasBaseSlab: true, baseAttached: true },
  { value: "TB_S", label: "Top + Base (sep)", hasTopSlab: true, hasBaseSlab: true, baseAttached: false },
  { value: "T", label: "Top only", hasTopSlab: true, hasBaseSlab: false, baseAttached: false },
  { value: "B_A", label: "Base only", hasTopSlab: false, hasBaseSlab: true, baseAttached: true },
  { value: "B_S", label: "Base only (sep)", hasTopSlab: false, hasBaseSlab: true, baseAttached: false },
  { value: "N", label: "Open top + bottom", hasTopSlab: false, hasBaseSlab: false, baseAttached: false },
];

function slabValueForRow(row: {
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  baseAttached: boolean;
}): string {
  return (
    SLAB_CHOICES.find(
      (choice) =>
        choice.hasTopSlab === row.hasTopSlab &&
        choice.hasBaseSlab === row.hasBaseSlab &&
        (!row.hasBaseSlab || choice.baseAttached === row.baseAttached),
    )?.value ?? "TB_A"
  );
}

function slabPatchForValue(value: string) {
  const choice =
    SLAB_CHOICES.find((entry) => entry.value === value) ?? SLAB_CHOICES[0];
  return {
    hasTopSlab: choice.hasTopSlab,
    hasBaseSlab: choice.hasBaseSlab,
    baseAttached: choice.baseAttached,
  };
}

/**
 * Slab choices the template supports (0 thickness = no such slab), always
 * keeping the currently selected value so the select stays controlled.
 */
function slabChoicesForTemplate(
  template: RectSheetTemplateOption | undefined,
  currentValue: string,
) {
  return SLAB_CHOICES.filter(
    (choice) =>
      choice.value === currentValue ||
      ((!choice.hasTopSlab ||
        !template ||
        template.topSlabThicknessInches > 0) &&
        (!choice.hasBaseSlab ||
          !template ||
          template.baseSlabThicknessInches > 0)),
  );
}

/** Force-off slab flags a template cannot have (used on template change). */
function slabPatchForTemplate(template: RectSheetTemplateOption | undefined) {
  const patch: {
    hasTopSlab?: boolean;
    hasBaseSlab?: boolean;
    baseAttached?: boolean;
  } = {};
  if (template && template.topSlabThicknessInches <= 0) {
    patch.hasTopSlab = false;
  }
  if (template && template.baseSlabThicknessInches <= 0) {
    patch.hasBaseSlab = false;
    patch.baseAttached = false;
  }
  return patch;
}

function uniqueMaterials(
  openingSizes: RectWorkbookOptions["openingSizes"],
): string[] {
  return [...new Set(openingSizes.map((entry) => entry.pipeMaterial))].sort();
}

function sizesForMaterial(
  openingSizes: RectWorkbookOptions["openingSizes"],
  material: string,
): number[] {
  return [
    ...new Set(
      openingSizes
        .filter((entry) => entry.pipeMaterial === material)
        .map((entry) => entry.pipeSizeInches),
    ),
  ].sort((a, b) => a - b);
}

/** Alternating background tones so each structure (row + detail band) reads as one block. */
function groupToneClasses(rowIndex: number, selected: boolean) {
  if (selected) {
    return { main: "bg-teal-100/70", detail: "bg-teal-50/60" };
  }
  return rowIndex % 2 === 0
    ? { main: "bg-white", detail: "bg-slate-50/70" }
    : { main: "bg-amber-50/50", detail: "bg-amber-50/80" };
}

type RectStructureWorkbookProps = {
  quoteId?: string;
  returnPath: string;
  initialLineItems: EditableQuoteLineItem[];
  templates: RectSheetTemplateOption[];
  castings: RectSheetCastingOption[];
  openingSizes: RectWorkbookOptions["openingSizes"];
};

export function RectStructureWorkbook({
  quoteId,
  returnPath,
  initialLineItems,
  templates,
  castings,
  openingSizes,
}: RectStructureWorkbookProps) {
  const router = useRouter();
  const options: RectWorkbookOptions = useMemo(
    () => ({ templates, castings, openingSizes }),
    [templates, castings, openingSizes],
  );

  const [defaults, setDefaults] = useState<RectWorkbookDefaults>(
    () =>
      readRectWorkbookSession(quoteId)?.defaults ??
      createDefaultRectDefaults(templates),
  );

  const [workbookMode, setWorkbookMode] = useState<RectWorkbookMode>(
    () => readRectWorkbookSession(quoteId)?.mode ?? "QUOTE",
  );

  const [passthroughLines] = useState<EditableQuoteLineItem[]>(() => {
    const session = readRectWorkbookSession(quoteId);
    if (session) {
      return session.passthroughLines;
    }
    return initialLineItems.filter((line) => !line.rectStructureConfig);
  });

  const [rows, setRows] = useState<RectWorkbookRow[]>(() => {
    const session = readRectWorkbookSession(quoteId);
    const mode = session?.mode ?? "QUOTE";
    if (session?.rows?.length) {
      return session.rows.map(normalizeRectWorkbookRow);
    }
    const workbookDefaults =
      session?.defaults ?? createDefaultRectDefaults(templates);
    const rectRows = initialLineItems
      .map((line) => rectLineItemToWorkbookRow(line))
      .filter((row): row is RectWorkbookRow => row != null)
      .map((row) =>
        computeRectWorkbookRow(normalizeRectWorkbookRow(row), options, mode),
      );
    if (rectRows.length > 0) {
      return rectRows;
    }
    const blank: RectWorkbookRow[] = [];
    for (let i = 0; i < 5; i += 1) {
      blank.push(createDefaultRectRow(templates, blank, workbookDefaults));
    }
    return blank;
  });

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback(
    (
      nextRows: RectWorkbookRow[],
      nextDefaults?: RectWorkbookDefaults,
      nextMode?: RectWorkbookMode,
    ) => {
      writeRectWorkbookSession(quoteId, {
        rows: nextRows,
        passthroughLines,
        returnPath: readWorkbookSession(quoteId)?.returnPath ?? returnPath,
        defaults: nextDefaults ?? defaults,
        mode: nextMode ?? workbookMode,
      });
    },
    [quoteId, passthroughLines, returnPath, defaults, workbookMode],
  );

  const handleRowsChange = useCallback(
    (nextRows: RectWorkbookRow[]) => {
      setDirty(true);
      setError(null);
      setRows(nextRows);
      persist(nextRows);
    },
    [persist],
  );

  function handleModeChange(nextMode: RectWorkbookMode) {
    if (nextMode === workbookMode) {
      return;
    }
    const converted = rows.map((row) => {
      const prepared = nextMode === "FULL" ? upgradeRectRowToFull(row) : row;
      return row.config || row.status
        ? computeRectWorkbookRow(prepared, options, nextMode)
        : prepared;
    });
    setWorkbookMode(nextMode);
    setDirty(true);
    setRows(converted);
    persist(converted, undefined, nextMode);
  }

  function updateDefaults(patch: Partial<RectWorkbookDefaults>) {
    const next = { ...defaults, ...patch };
    setDefaults(next);
    persist(rows, next);
  }

  function addRows(count: number) {
    const additions: RectWorkbookRow[] = [];
    for (let i = 0; i < count; i += 1) {
      additions.push(
        createDefaultRectRow(templates, [...rows, ...additions], defaults),
      );
    }
    handleRowsChange([...rows, ...additions]);
  }

  function duplicateSelected() {
    const additions: RectWorkbookRow[] = [];
    for (const row of rows) {
      if (selectedRowIds.has(row.id)) {
        additions.push(
          computeRectWorkbookRow(
            duplicateRectRow(row, [...rows, ...additions], defaults),
            options,
            workbookMode,
          ),
        );
      }
    }
    if (additions.length > 0) {
      handleRowsChange([...rows, ...additions]);
      setSelectedRowIds(new Set());
    }
  }

  function removeSelected() {
    handleRowsChange(rows.filter((row) => !selectedRowIds.has(row.id)));
    setSelectedRowIds(new Set());
  }

  function removeEmptyRows() {
    const next = rows.filter(
      (row) =>
        row.rimElevation.trim() !== "" ||
        row.lowInvertElevation.trim() !== "" ||
        row.openings.some((opening) => opening.invertElevation.trim() !== "") ||
        row.config != null,
    );
    if (next.length !== rows.length) {
      handleRowsChange(next);
      setSelectedRowIds(new Set());
    }
  }

  const effectiveReturnPath =
    readWorkbookSession(quoteId)?.returnPath ?? returnPath;

  function handleApply() {
    const committed = rows.map((row) =>
      computeRectWorkbookRow(row, options, workbookMode),
    );
    setRows(committed);
    persist(committed);

    const meaningful = committed.filter(
      (row) =>
        row.rimElevation.trim() !== "" ||
        row.lowInvertElevation.trim() !== "" ||
        row.openings.some((opening) => opening.invertElevation.trim() !== "") ||
        row.config != null,
    );
    const validRows = meaningful.filter(
      (row) => row.config && row.unitPrice != null,
    );

    if (validRows.length === 0) {
      setError(
        "Enter at least one structure with a size, rim, and invert that prices cleanly.",
      );
      return;
    }
    if (validRows.length < meaningful.length) {
      setError(
        "Some structures have problems (see their status) — fix or clear them before applying.",
      );
      return;
    }

    const rectLines = validRows
      .map((row, index) => rectWorkbookRowToLineItem(row, index + 1))
      .filter((line): line is EditableQuoteLineItem => line != null);

    writeWorkbookApplyPayload(quoteId, {
      lineItems: buildRectApplyLineItems(passthroughLines, rectLines),
      returnPath: effectiveReturnPath,
    });
    router.push(effectiveReturnPath);
  }

  function handleCancel() {
    if (
      dirty &&
      !window.confirm("Discard unsaved workbook changes and return to the quote?")
    ) {
      return;
    }
    router.push(effectiveReturnPath);
  }

  const pricedRows = rows.filter((row) => row.unitPrice != null);
  const pricedTotal = pricedRows.reduce((sum, row) => {
    const qty = Number(row.qty);
    return sum + (row.unitPrice ?? 0) * (Number.isFinite(qty) && qty > 0 ? qty : 1);
  }, 0);
  const maxPick = defaults.maxPickWeightLbs.trim()
    ? Number(defaults.maxPickWeightLbs)
    : null;

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No active rectangular templates yet. Create one in{" "}
        <Link href="/structures" className="font-semibold underline">
          Structures
        </Link>{" "}
        first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RectDefaultsPanel
        defaults={defaults}
        templates={templates}
        castings={castings}
        onChange={updateDefaults}
      />

      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Entry mode</p>
        <p className="mt-1 text-xs text-slate-600">
          Choose quote-only for fast pricing (just size, rim, and low
          invert), or full drill sheet detail when you already know every
          opening's wall, invert, and placement. Quote-only rows can be
          upgraded later in this workbook.
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
            onClick={() => handleModeChange("FULL")}
            className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${
              workbookMode === "FULL"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            Full drill sheet
          </button>
        </div>
      </div>

      <SectionCard
        title="Rectangular Structure Workbook"
        description={
          workbookMode === "FULL"
            ? "Enter structures with full opening detail (wall, invert, placement). Each structure's openings sit in the band under its row. Rect sheets can be created from the quote after award."
            : "One row per structure — size, rim, and low invert are all it takes to price. Use arrow keys or Tab to move between cells; prices calculate when you leave a cell. Paste rows from Excel (tab-separated)."
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

        <RectWorkbookGrid
          rows={rows}
          options={options}
          defaults={defaults}
          workbookMode={workbookMode}
          maxPickLbs={maxPick}
          selectedRowIds={selectedRowIds}
          onRowsChange={handleRowsChange}
          onSelectionChange={setSelectedRowIds}
        />

        <p className="mt-2 text-[11px] text-slate-500">
          {pricedRows.length} of {rows.length} rows priced
          {pricedRows.length > 0
            ? ` — extended total ${formatQuoteCurrency(pricedTotal)}`
            : ""}
          .
          {workbookMode === "QUOTE"
            ? " Paste column order: Structure #, Template, Length, Width, Rim, Low Invert, Qty."
            : " Enter openings in the band under each row; the low invert is derived automatically."}
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

function RectDefaultsPanel({
  defaults,
  templates,
  castings,
  onChange,
}: {
  defaults: RectWorkbookDefaults;
  templates: RectSheetTemplateOption[];
  castings: RectSheetCastingOption[];
  onChange: (patch: Partial<RectWorkbookDefaults>) => void;
}) {
  const template = templates.find((entry) => entry.id === defaults.templateId);
  return (
    <SectionCard
      title="Defaults for New Rows"
      description="Applied when you add, duplicate, or paste rows. Max pick weight flags structures that will need a split at drill-sheet time."
    >
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <div>
          <label className="block text-[11px] font-medium text-slate-700">
            Name Prefix
          </label>
          <input
            type="text"
            value={defaults.namePrefix}
            onChange={(e) => onChange({ namePrefix: e.target.value })}
            className={structureInputClassName}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-700">
            Start #
          </label>
          <input
            type="number"
            min="1"
            value={defaults.startNumber}
            onChange={(e) =>
              onChange({ startNumber: Number(e.target.value) || 1 })
            }
            className={structureInputClassName}
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-700">
            Template
          </label>
          <select
            value={defaults.templateId}
            onChange={(e) =>
              onChange({
                templateId: e.target.value,
                ...slabPatchForTemplate(
                  templates.find((entry) => entry.id === e.target.value),
                ),
              })
            }
            className={structureInputClassName}
          >
            {templates.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-700">
            Casting
          </label>
          <select
            value={defaults.castingProductId}
            onChange={(e) => onChange({ castingProductId: e.target.value })}
            className={structureInputClassName}
          >
            <option value="">— None —</option>
            {castings.map((casting) => (
              <option key={casting.id} value={casting.id}>
                {casting.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-700">
            Size L x W (ft)
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              inputMode="decimal"
              value={defaults.insideLengthFeet}
              onChange={(e) => onChange({ insideLengthFeet: e.target.value })}
              className={structureInputClassName}
            />
            <input
              type="text"
              inputMode="decimal"
              value={defaults.insideWidthFeet}
              onChange={(e) => onChange({ insideWidthFeet: e.target.value })}
              className={structureInputClassName}
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-700">
            Slabs
          </label>
          <select
            value={slabValueForRow(defaults)}
            onChange={(e) => onChange(slabPatchForValue(e.target.value))}
            className={structureInputClassName}
          >
            {slabChoicesForTemplate(template, slabValueForRow(defaults)).map(
              (choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-700">
            Max Pick (lbs)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={defaults.maxPickWeightLbs}
            onChange={(e) => onChange({ maxPickWeightLbs: e.target.value })}
            placeholder="12000"
            className={structureInputClassName}
          />
        </div>
      </div>
      {template && template.presetSizes.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Presets
          </span>
          {template.presetSizes.map((size) => (
            <button
              key={size.id}
              type="button"
              onClick={() =>
                onChange({
                  insideLengthFeet: String(size.insideLengthFeet),
                  insideWidthFeet: String(size.insideWidthFeet),
                })
              }
              className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            >
              {size.insideLengthFeet}' x {size.insideWidthFeet}'
            </button>
          ))}
        </div>
      ) : null}
    </SectionCard>
  );
}

/** Full-detail openings editor: an aligned sub-table under the main row. */
function RowOpeningsEditor({
  row,
  options,
  onRowPatch,
}: {
  row: RectWorkbookRow;
  options: RectWorkbookOptions;
  onRowPatch: (patch: Partial<RectWorkbookRow>) => void;
}) {
  const materials = useMemo(
    () => uniqueMaterials(options.openingSizes),
    [options.openingSizes],
  );

  const patchOpening = (
    openingId: string,
    patch: Partial<RectWorkbookOpeningRow>,
  ) => {
    onRowPatch({
      openings: row.openings.map((opening) =>
        opening.id === openingId ? { ...opening, ...patch } : opening,
      ),
    });
  };

  const subHeader =
    "border-b border-r border-slate-200 bg-slate-100/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 last:border-r-0";
  const subCell = "border-b border-r border-slate-200 p-0 last:border-r-0";
  const subInput = `${tableCellInputClassName} py-1`;

  return (
    <div className="py-2 pl-10 pr-3">
      <table className="border-separate border-spacing-0 rounded border border-slate-200 bg-white/60 text-xs">
        <thead>
          <tr>
            <th className={`${subHeader} w-10 text-center`}>#</th>
            <th className={`${subHeader} w-20`}>Wall</th>
            <th className={`${subHeader} min-w-[9rem]`}>Material</th>
            <th className={`${subHeader} w-20`}>Size</th>
            <th className={`${subHeader} w-24`}>Invert</th>
            <th className={`${subHeader} min-w-[7rem]`}>Placement</th>
            <th className={`${subHeader} w-20`}>Offset (in)</th>
            <th className={`${subHeader} w-16`}>Angle</th>
            <th className={`${subHeader} w-20`}>Skew W (in)</th>
            <th className={`${subHeader} w-8`}></th>
          </tr>
        </thead>
        <tbody>
          {row.openings.map((opening) => {
            const sizes = sizesForMaterial(
              options.openingSizes,
              opening.pipeMaterial,
            );
            const dimensioned =
              opening.placement === "FROM_LEFT" ||
              opening.placement === "FROM_RIGHT";
            return (
              <tr key={opening.id}>
                <td
                  className={`${subCell} px-2 py-1 text-center text-[11px] font-semibold text-slate-700`}
                >
                  {opening.label}
                </td>
                <td className={subCell}>
                  <select
                    value={opening.wall}
                    onChange={(event) =>
                      patchOpening(opening.id, {
                        wall: event.target.value as RectWall,
                      })
                    }
                    className={subInput}
                  >
                    {WALL_OPTIONS.map((wall) => (
                      <option key={wall} value={wall}>
                        {RECT_WALL_LABELS[wall]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={subCell}>
                  <select
                    value={opening.pipeMaterial}
                    onChange={(event) =>
                      patchOpening(opening.id, {
                        pipeMaterial: event.target.value,
                        pipeSizeInches: "",
                      })
                    }
                    className={subInput}
                  >
                    <option value="">—</option>
                    {materials.map((material) => (
                      <option key={material} value={material}>
                        {material}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={subCell}>
                  <select
                    value={opening.pipeSizeInches}
                    onChange={(event) =>
                      patchOpening(opening.id, {
                        pipeSizeInches: event.target.value,
                      })
                    }
                    className={subInput}
                  >
                    <option value="">—</option>
                    {sizes.map((size) => (
                      <option key={size} value={String(size)}>
                        {size}&quot;
                      </option>
                    ))}
                  </select>
                </td>
                <td className={subCell}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={opening.invertElevation}
                    onChange={(event) =>
                      patchOpening(opening.id, {
                        invertElevation: event.target.value,
                      })
                    }
                    title="Invert elevation (ft)"
                    className={`${subInput} text-right tabular-nums`}
                  />
                </td>
                <td className={subCell}>
                  <select
                    value={opening.placement}
                    onChange={(event) =>
                      patchOpening(opening.id, {
                        placement: event.target.value as RectOpeningPlacement,
                      })
                    }
                    className={subInput}
                  >
                    <option value="CENTERED">Centered</option>
                    <option value="FROM_LEFT">From left</option>
                    <option value="FROM_RIGHT">From right</option>
                    <option value="TOUCH_LEFT">Touch left</option>
                    <option value="TOUCH_RIGHT">Touch right</option>
                  </select>
                </td>
                <td className={subCell}>
                  {dimensioned ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={opening.offsetInches}
                      onChange={(event) =>
                        patchOpening(opening.id, {
                          offsetInches: event.target.value,
                        })
                      }
                      title="Centerline offset from that inside face (inches)"
                      className={`${subInput} text-right tabular-nums`}
                    />
                  ) : (
                    <span className="block px-2 py-1 text-center text-slate-300">
                      —
                    </span>
                  )}
                </td>
                <td className={subCell}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={opening.angle}
                    onChange={(event) =>
                      patchOpening(opening.id, { angle: event.target.value })
                    }
                    title="Skew angle (degrees off perpendicular)"
                    className={`${subInput} text-right tabular-nums`}
                  />
                </td>
                <td className={subCell}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={opening.widthOverrideInches}
                    onChange={(event) =>
                      patchOpening(opening.id, {
                        widthOverrideInches: event.target.value,
                      })
                    }
                    title="Manual opening width for skewed pipes (inches)"
                    className={`${subInput} text-right tabular-nums`}
                  />
                </td>
                <td className={`${subCell} text-center`}>
                  <button
                    type="button"
                    onClick={() =>
                      onRowPatch({
                        openings: row.openings.filter(
                          (entry) => entry.id !== opening.id,
                        ),
                      })
                    }
                    disabled={row.openings.length <= 1}
                    title="Remove this opening"
                    className="px-2 py-1 text-[10px] font-semibold text-red-600 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-1.5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() =>
            onRowPatch({
              openings: [
                ...row.openings,
                createRectOpeningRow(
                  String.fromCharCode(65 + row.openings.length),
                ),
              ],
            })
          }
          className="rounded border border-slate-200 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-white"
        >
          + Opening
        </button>
        {row.hasTopSlab ? (
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
            TOP SLAB OPENING
            <input
              type="text"
              inputMode="decimal"
              value={row.topSlabOpeningLengthInches}
              onChange={(event) =>
                onRowPatch({ topSlabOpeningLengthInches: event.target.value })
              }
              placeholder="casting"
              className={`${tableInlineInputClassName} w-16 border-slate-200 text-right`}
            />
            ×
            <input
              type="text"
              inputMode="decimal"
              value={row.topSlabOpeningWidthInches}
              onChange={(event) =>
                onRowPatch({ topSlabOpeningWidthInches: event.target.value })
              }
              placeholder="casting"
              className={`${tableInlineInputClassName} w-16 border-slate-200 text-right`}
            />
            in, touches
            <select
              value={row.topSlabOpeningSide}
              onChange={(event) =>
                onRowPatch({
                  topSlabOpeningSide: event.target.value as RectWall,
                })
              }
              className={`${tableInlineInputClassName} border-slate-200`}
            >
              {WALL_OPTIONS.map((wall) => (
                <option key={wall} value={wall}>
                  {RECT_WALL_LABELS[wall]} wall
                </option>
              ))}
            </select>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Exported for the post-award "complete drill sheets" workbook page too. */
export function RectWorkbookGrid({
  rows,
  options,
  defaults,
  workbookMode,
  maxPickLbs,
  selectedRowIds,
  onRowsChange,
  onSelectionChange,
}: {
  rows: RectWorkbookRow[];
  options: RectWorkbookOptions;
  defaults: RectWorkbookDefaults;
  workbookMode: RectWorkbookMode;
  maxPickLbs: number | null;
  selectedRowIds: Set<string>;
  onRowsChange: (rows: RectWorkbookRow[]) => void;
  onSelectionChange: (selected: Set<string>) => void;
}) {
  const tableRef = useRef<HTMLTableElement>(null);
  const isQuoteMode = workbookMode === "QUOTE";

  // Keyboard-navigable columns (data-wb-col): structure#, template, L, W,
  // casting, rim, [low invert in quote mode], slabs, qty.
  const navColumnCount = isQuoteMode ? 9 : 8;

  const patchRow = useCallback(
    (rowId: string, patch: Partial<RectWorkbookRow>) => {
      onRowsChange(
        rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
      );
    },
    [onRowsChange, rows],
  );

  const commitRow = useCallback(
    (rowId: string) => {
      onRowsChange(
        rows.map((row) =>
          row.id === rowId
            ? computeRectWorkbookRow(row, options, workbookMode)
            : row,
        ),
      );
    },
    [onRowsChange, options, rows, workbookMode],
  );

  const patchAndCommitRow = useCallback(
    (rowId: string, patch: Partial<RectWorkbookRow>) => {
      onRowsChange(
        rows.map((row) =>
          row.id === rowId
            ? computeRectWorkbookRow({ ...row, ...patch }, options, workbookMode)
            : row,
        ),
      );
    },
    [onRowsChange, options, rows, workbookMode],
  );

  const focusCell = (rowIndex: number, colIndex: number) => {
    const table = tableRef.current;
    if (!table) {
      return;
    }
    const el = table.querySelector<HTMLElement>(
      `[data-wb-row="${rowIndex}"][data-wb-col="${colIndex}"]`,
    );
    el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const handleCellKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colIndex: number,
  ) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextRow = event.key === "ArrowUp" ? rowIndex - 1 : rowIndex + 1;
      if (nextRow >= 0 && nextRow < rows.length) {
        focusCell(nextRow, colIndex);
      }
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const nextCol = event.key === "ArrowLeft" ? colIndex - 1 : colIndex + 1;
      if (nextCol >= 0 && nextCol < navColumnCount) {
        focusCell(rowIndex, nextCol);
      }
      return;
    }

    if (event.key === "Tab" || event.key === "Enter") {
      event.preventDefault();
      const direction = event.shiftKey ? -1 : 1;
      let nextCol = colIndex + direction;
      let nextRow = rowIndex;

      if (nextCol >= navColumnCount) {
        nextCol = 0;
        nextRow += 1;
      } else if (nextCol < 0) {
        nextCol = navColumnCount - 1;
        nextRow -= 1;
      }

      if (nextRow >= 0 && nextRow < rows.length) {
        focusCell(nextRow, nextCol);
      }
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTableElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) {
      return;
    }
    event.preventDefault();
    const tsvRows = parseTsvPaste(text);
    const pasted = applyRectTsvToRows(
      tsvRows,
      options.templates,
      defaults,
      rows,
    ).map((row) => computeRectWorkbookRow(row, options, workbookMode));
    onRowsChange([...rows, ...pasted]);
  };

  const toggleRowSelection = (rowId: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    onSelectionChange(next);
  };

  const allSelected =
    rows.length > 0 && rows.every((row) => selectedRowIds.has(row.id));

  const toggleSelectAll = () => {
    onSelectionChange(
      allSelected ? new Set() : new Set(rows.map((row) => row.id)),
    );
  };

  const mainColumnCount = 14;
  let navCol = 0;
  const columnIndexes = {
    structureNumber: navCol++,
    template: navCol++,
    length: navCol++,
    width: navCol++,
    casting: navCol++,
    rim: navCol++,
    lowInvert: isQuoteMode ? navCol++ : -1,
    slabs: navCol++,
    qty: navCol++,
  };

  const numericInput = `${tableCellInputClassName} text-right tabular-nums`;

  return (
    <div className={tableWrapperClassName}>
      <table ref={tableRef} className={tableClassName} onPaste={handlePaste}>
        <thead>
          <tr>
            <th className={`${tableHeaderCellClassName} w-8 text-center`}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                title={allSelected ? "Deselect all rows" : "Select all rows"}
                className="rounded border-slate-300"
              />
            </th>
            <th className={`${tableHeaderCellClassName} min-w-[6rem]`}>
              Structure #
            </th>
            <th className={`${tableHeaderCellClassName} min-w-[8rem]`}>
              Template
            </th>
            <th className={`${tableHeaderCellClassName} w-16`}>L (ft)</th>
            <th className={`${tableHeaderCellClassName} w-16`}>W (ft)</th>
            <th className={`${tableHeaderCellClassName} min-w-[8rem]`}>
              Casting
            </th>
            <th className={`${tableHeaderCellClassName} w-20`}>Rim</th>
            <th className={`${tableHeaderCellClassName} w-20`}>Low Inv</th>
            <th className={`${tableHeaderCellClassName} min-w-[8rem]`}>
              Slabs
            </th>
            <th className={`${tableHeaderCellClassName} w-12`}>Qty</th>
            <th className={`${tableHeaderCellClassName} w-16 text-right`}>
              Wall Ht
            </th>
            <th className={`${tableHeaderCellClassName} w-20 text-right`}>
              Pick (lbs)
            </th>
            <th className={`${tableHeaderCellClassName} w-20 text-right`}>
              Unit Price
            </th>
            <th className={`${tableHeaderCellClassName} min-w-[10rem]`}>
              Status
            </th>
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {rows.map((row, rowIndex) => {
            const selected = selectedRowIds.has(row.id);
            const tone = groupToneClasses(rowIndex, selected);
            const overPick =
              maxPickLbs != null &&
              row.heaviestPickLbs != null &&
              row.heaviestPickLbs > maxPickLbs;
            const breakdown = row.config
              ? [
                  `walls ${formatQuoteCurrency(row.config.wallPrice ?? 0)}`,
                  row.config.topSlabPrice
                    ? `top ${formatQuoteCurrency(row.config.topSlabPrice)}`
                    : null,
                  row.config.baseSlabPrice
                    ? `base ${formatQuoteCurrency(row.config.baseSlabPrice)}`
                    : null,
                  row.config.openingsPrice
                    ? `openings ${formatQuoteCurrency(row.config.openingsPrice)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" + ")
              : "";
            const computedCell = `${tableCellBordersClassName} whitespace-nowrap px-2 py-1.5 text-right text-[11px] tabular-nums`;

            return (
              <Fragment key={row.id}>
                <tr className={tone.main}>
                  <td
                    className={`${tableCellBordersClassName} w-8 text-center align-middle`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleRowSelection(row.id)}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className={tableGridCellClassName}>
                    <input
                      type="text"
                      value={row.structureNumber}
                      data-wb-row={rowIndex}
                      data-wb-col={columnIndexes.structureNumber}
                      onChange={(event) =>
                        patchRow(row.id, {
                          structureNumber: event.target.value,
                        })
                      }
                      onBlur={() => commitRow(row.id)}
                      onKeyDown={(event) =>
                        handleCellKeyDown(
                          event,
                          rowIndex,
                          columnIndexes.structureNumber,
                        )
                      }
                      className={tableCellInputClassName}
                    />
                  </td>
                  <td className={tableGridCellClassName}>
                    <select
                      value={row.templateId}
                      data-wb-row={rowIndex}
                      data-wb-col={columnIndexes.template}
                      onChange={(event) => {
                        const nextTemplate = options.templates.find(
                          (entry) => entry.id === event.target.value,
                        );
                        patchAndCommitRow(row.id, {
                          templateId: event.target.value,
                          castingProductId:
                            nextTemplate?.defaultCastingProductId ??
                            row.castingProductId,
                          ...slabPatchForTemplate(nextTemplate),
                        });
                      }}
                      onKeyDown={(event) =>
                        handleCellKeyDown(
                          event,
                          rowIndex,
                          columnIndexes.template,
                        )
                      }
                      className={tableCellInputClassName}
                    >
                      {options.templates.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={tableGridCellClassName}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.insideLengthFeet}
                      data-wb-row={rowIndex}
                      data-wb-col={columnIndexes.length}
                      onChange={(event) =>
                        patchRow(row.id, {
                          insideLengthFeet: event.target.value,
                        })
                      }
                      onBlur={() => commitRow(row.id)}
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, columnIndexes.length)
                      }
                      className={numericInput}
                    />
                  </td>
                  <td className={tableGridCellClassName}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.insideWidthFeet}
                      data-wb-row={rowIndex}
                      data-wb-col={columnIndexes.width}
                      onChange={(event) =>
                        patchRow(row.id, {
                          insideWidthFeet: event.target.value,
                        })
                      }
                      onBlur={() => commitRow(row.id)}
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, columnIndexes.width)
                      }
                      className={numericInput}
                    />
                  </td>
                  <td className={tableGridCellClassName}>
                    <select
                      value={row.castingProductId}
                      data-wb-row={rowIndex}
                      data-wb-col={columnIndexes.casting}
                      onChange={(event) =>
                        patchAndCommitRow(row.id, {
                          castingProductId: event.target.value,
                        })
                      }
                      onKeyDown={(event) =>
                        handleCellKeyDown(
                          event,
                          rowIndex,
                          columnIndexes.casting,
                        )
                      }
                      className={tableCellInputClassName}
                    >
                      <option value="">—</option>
                      {options.castings.map((casting) => (
                        <option key={casting.id} value={casting.id}>
                          {casting.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={tableGridCellClassName}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.rimElevation}
                      data-wb-row={rowIndex}
                      data-wb-col={columnIndexes.rim}
                      onChange={(event) =>
                        patchRow(row.id, { rimElevation: event.target.value })
                      }
                      onBlur={() => commitRow(row.id)}
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, columnIndexes.rim)
                      }
                      className={numericInput}
                    />
                  </td>
                  {isQuoteMode ? (
                    <td className={tableGridCellClassName}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.lowInvertElevation}
                        data-wb-row={rowIndex}
                        data-wb-col={columnIndexes.lowInvert}
                        onChange={(event) =>
                          patchRow(row.id, {
                            lowInvertElevation: event.target.value,
                          })
                        }
                        onBlur={() => commitRow(row.id)}
                        onKeyDown={(event) =>
                          handleCellKeyDown(
                            event,
                            rowIndex,
                            columnIndexes.lowInvert,
                          )
                        }
                        className={numericInput}
                      />
                    </td>
                  ) : (
                    <td
                      className={`${computedCell} bg-slate-50/60 text-slate-500`}
                      title="Derived from the lowest opening invert below"
                    >
                      {row.lowInvertElevation || "—"}
                    </td>
                  )}
                  <td className={tableGridCellClassName}>
                    <select
                      value={slabValueForRow(row)}
                      data-wb-row={rowIndex}
                      data-wb-col={columnIndexes.slabs}
                      onChange={(event) =>
                        patchAndCommitRow(
                          row.id,
                          slabPatchForValue(event.target.value),
                        )
                      }
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, columnIndexes.slabs)
                      }
                      className={tableCellInputClassName}
                    >
                      {slabChoicesForTemplate(
                        options.templates.find(
                          (entry) => entry.id === row.templateId,
                        ),
                        slabValueForRow(row),
                      ).map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={tableGridCellClassName}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={row.qty}
                      data-wb-row={rowIndex}
                      data-wb-col={columnIndexes.qty}
                      onChange={(event) =>
                        patchRow(row.id, { qty: event.target.value })
                      }
                      onBlur={() => commitRow(row.id)}
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, columnIndexes.qty)
                      }
                      className={`${tableCellInputClassName} text-center tabular-nums`}
                    />
                  </td>
                  <td className={`${computedCell} bg-slate-50/60 text-slate-700`}>
                    {row.wallHeightFeet != null
                      ? `${row.wallHeightFeet.toFixed(2)}'`
                      : "—"}
                  </td>
                  <td
                    className={`${computedCell} ${
                      overPick
                        ? "bg-rose-50 font-semibold text-rose-600"
                        : "bg-slate-50/60 text-slate-700"
                    }`}
                    title={
                      overPick
                        ? "Over the max pick weight — will need a split at drill-sheet time"
                        : undefined
                    }
                  >
                    {row.heaviestPickLbs != null
                      ? formatPounds(row.heaviestPickLbs).replace(" lbs", "")
                      : "—"}
                    {overPick ? " ⚠" : ""}
                  </td>
                  <td
                    className={`${computedCell} bg-slate-50/60 font-semibold text-slate-900`}
                    title={breakdown}
                  >
                    {row.unitPrice != null
                      ? formatQuoteCurrency(row.unitPrice)
                      : "—"}
                  </td>
                  <td
                    className={`${tableCellBordersClassName} max-w-[16rem] truncate px-2 py-1.5 text-[11px] text-slate-600`}
                    title={row.status}
                  >
                    {row.status || "—"}
                  </td>
                </tr>
                {!isQuoteMode ? (
                  <tr className={tone.detail}>
                    <td
                      colSpan={mainColumnCount}
                      className="border-b-2 border-slate-300/70"
                    >
                      <RowOpeningsEditor
                        row={row}
                        options={options}
                        onRowPatch={(patch) => patchAndCommitRow(row.id, patch)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
