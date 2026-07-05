"use client";

import {
  useCallback,
  useMemo,
  useRef,
  Fragment,
  type KeyboardEvent,
} from "react";
import type { DrillSheetTemplateOption } from "@/components/drill-sheets/drill-sheet-form";
import { structureTableInputClassName } from "@/components/structures/structure-utils";
import { formatQuoteCurrency } from "@/components/quotes/quote-utils";
import {
  applyTsvToRows,
  commitAllWorkbookRowPrices,
  commitWorkbookRowPrice,
  createDefaultOpening,
  createDefaultPenetration,
  createDefaultWorkbookRow,
  nextOpeningLabel,
  parseTsvPaste,
  syncRowFromOpenings,
  syncRowFromPenetrations,
  type StructureWorkbookDefaults,
  type StructureWorkbookOpeningRow,
  type StructureWorkbookOptions,
  type StructureWorkbookPenetration,
  type StructureWorkbookRow,
  type WorkbookMode,
} from "@/lib/quotes/structure-workbook";

type StructureWorkbookGridProps = {
  rows: StructureWorkbookRow[];
  options: StructureWorkbookOptions;
  defaults: StructureWorkbookDefaults;
  workbookMode: WorkbookMode;
  selectedRowIds: Set<string>;
  onRowsChange: (rows: StructureWorkbookRow[]) => void;
  onSelectionChange: (selected: Set<string>) => void;
};

function uniquePipeMaterials(
  pipeOpeningSizes: StructureWorkbookOptions["pipeOpeningSizes"],
): string[] {
  return [...new Set(pipeOpeningSizes.map((entry) => entry.pipeMaterial))].sort();
}

function pipeSizesForMaterial(
  pipeOpeningSizes: StructureWorkbookOptions["pipeOpeningSizes"],
  material: string,
): number[] {
  return [
    ...new Set(
      pipeOpeningSizes
        .filter((entry) => entry.pipeMaterial === material)
        .map((entry) => entry.pipeSizeInches),
    ),
  ].sort((a, b) => a - b);
}

/** Alternating background tones so each structure (row + pipe band) reads as one block. */
function groupToneClasses(rowIndex: number, selected: boolean) {
  if (selected) {
    return {
      main: "bg-sky-100/70",
      detail: "bg-sky-50/60",
    };
  }
  return rowIndex % 2 === 0
    ? { main: "bg-white", detail: "bg-slate-50/70" }
    : { main: "bg-amber-50/50", detail: "bg-amber-50/80" };
}

function RowPenetrationsEditor({
  row,
  options,
  onPenetrationsChange,
}: {
  row: StructureWorkbookRow;
  options: StructureWorkbookOptions;
  onPenetrationsChange: (penetrations: StructureWorkbookPenetration[]) => void;
}) {
  const pipeMaterials = useMemo(
    () => uniquePipeMaterials(options.pipeOpeningSizes),
    [options.pipeOpeningSizes],
  );
  const penetrations = row.penetrations ?? [];

  const patchPenetration = (
    penetrationId: string,
    patch: Partial<StructureWorkbookPenetration>,
  ) => {
    onPenetrationsChange(
      penetrations.map((penetration) =>
        penetration.id === penetrationId
          ? { ...penetration, ...patch }
          : penetration,
      ),
    );
  };

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-1 py-1.5 pl-10 pr-3">
      <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Pipes
      </span>
      <div className="flex flex-col gap-1">
        {penetrations.map((penetration) => {
          const sizes = pipeSizesForMaterial(
            options.pipeOpeningSizes,
            penetration.pipeMaterial,
          );

          return (
            <div key={penetration.id} className="flex items-center gap-1.5">
              <select
                value={penetration.pipeMaterial}
                onChange={(event) =>
                  patchPenetration(penetration.id, {
                    pipeMaterial: event.target.value,
                    pipeSizeInches: "",
                  })
                }
                className={`${structureTableInputClassName} min-w-[9rem]`}
              >
                <option value="">— material —</option>
                {pipeMaterials.map((material) => (
                  <option key={material} value={material}>
                    {material}
                  </option>
                ))}
              </select>
              <select
                value={penetration.pipeSizeInches}
                onChange={(event) =>
                  patchPenetration(penetration.id, {
                    pipeSizeInches: event.target.value,
                  })
                }
                className={`${structureTableInputClassName} min-w-[4.5rem]`}
              >
                <option value="">— size —</option>
                {sizes.map((size) => (
                  <option key={size} value={String(size)}>
                    {size}&quot;
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-500">×</span>
              <input
                type="text"
                inputMode="numeric"
                value={penetration.qty}
                onChange={(event) =>
                  patchPenetration(penetration.id, {
                    qty: event.target.value,
                  })
                }
                title="Number of pipes this size"
                className={`${structureTableInputClassName} w-12 text-center`}
              />
              <button
                type="button"
                onClick={() =>
                  onPenetrationsChange(
                    penetrations.filter(
                      (entry) => entry.id !== penetration.id,
                    ),
                  )
                }
                disabled={penetrations.length <= 1}
                title="Remove this pipe size"
                className="text-[10px] font-semibold text-red-600 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() =>
          onPenetrationsChange([...penetrations, createDefaultPenetration()])
        }
        className="mt-0.5 rounded border border-slate-200 bg-white/70 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-white"
      >
        + Pipe size
      </button>
    </div>
  );
}

function RowOpeningsEditor({
  row,
  options,
  onOpeningsChange,
}: {
  row: StructureWorkbookRow;
  options: StructureWorkbookOptions;
  onOpeningsChange: (openings: StructureWorkbookOpeningRow[]) => void;
}) {
  const pipeMaterials = useMemo(
    () => uniquePipeMaterials(options.pipeOpeningSizes),
    [options.pipeOpeningSizes],
  );

  const patchOpening = (
    openingId: string,
    patch: Partial<StructureWorkbookOpeningRow>,
  ) => {
    onOpeningsChange(
      row.openings.map((opening) =>
        opening.id === openingId ? { ...opening, ...patch } : opening,
      ),
    );
  };

  return (
    <div className="py-1.5 pl-10 pr-3">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Openings
        </span>
        <span className="text-[10px] text-slate-400">
          material · size · invert · angle
        </span>
        <button
          type="button"
          onClick={() =>
            onOpeningsChange([
              ...row.openings,
              createDefaultOpening(nextOpeningLabel(row.openings.length)),
            ])
          }
          className="rounded border border-slate-200 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-white"
        >
          + Opening
        </button>
      </div>
      <div className="mt-1 flex flex-col gap-1">
        {row.openings.map((opening) => {
          const sizes = pipeSizesForMaterial(
            options.pipeOpeningSizes,
            opening.pipeMaterial,
          );

          return (
            <div key={opening.id} className="flex items-center gap-1.5">
              <span className="w-5 text-center text-[11px] font-semibold text-slate-700">
                {opening.label}
              </span>
              <select
                value={opening.pipeMaterial}
                onChange={(event) =>
                  patchOpening(opening.id, {
                    pipeMaterial: event.target.value,
                    pipeSizeInches: "",
                  })
                }
                className={`${structureTableInputClassName} min-w-[9rem]`}
              >
                <option value="">— material —</option>
                {pipeMaterials.map((material) => (
                  <option key={material} value={material}>
                    {material}
                  </option>
                ))}
              </select>
              <select
                value={opening.pipeSizeInches}
                onChange={(event) =>
                  patchOpening(opening.id, {
                    pipeSizeInches: event.target.value,
                  })
                }
                className={`${structureTableInputClassName} min-w-[4.5rem]`}
              >
                <option value="">— size —</option>
                {sizes.map((size) => (
                  <option key={size} value={String(size)}>
                    {size}&quot;
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="decimal"
                placeholder="invert"
                value={opening.invertElevation}
                onChange={(event) =>
                  patchOpening(opening.id, {
                    invertElevation: event.target.value,
                  })
                }
                title="Invert elevation (ft)"
                className={`${structureTableInputClassName} w-20`}
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder="angle"
                value={opening.angleDegrees}
                onChange={(event) =>
                  patchOpening(opening.id, {
                    angleDegrees: event.target.value,
                  })
                }
                title="Angle (degrees clockwise from outlet)"
                className={`${structureTableInputClassName} w-16`}
              />
              <button
                type="button"
                onClick={() =>
                  onOpeningsChange(
                    row.openings.filter((entry) => entry.id !== opening.id),
                  )
                }
                disabled={row.openings.length <= 1}
                title="Remove this opening"
                className="text-[10px] font-semibold text-red-600 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StructureWorkbookGrid({
  rows,
  options,
  defaults,
  workbookMode,
  selectedRowIds,
  onRowsChange,
  onSelectionChange,
}: StructureWorkbookGridProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const isFullMode = workbookMode === "DRILL_SHEET";

  // Keyboard-navigable columns (data-wb-col): structure#, template, dia,
  // casting, rim, [low invert in quote mode], qty.
  const navColumnCount = isFullMode ? 6 : 7;
  const qtyColIndex = isFullMode ? 5 : 6;

  const patchRow = useCallback(
    (rowId: string, patch: Partial<StructureWorkbookRow>) => {
      onRowsChange(
        rows.map((row) =>
          row.id === rowId ? { ...row, ...patch } : row,
        ),
      );
    },
    [onRowsChange, rows],
  );

  const commitRow = useCallback(
    (rowId: string) => {
      onRowsChange(
        rows.map((row) =>
          row.id === rowId
            ? commitWorkbookRowPrice(row, options, workbookMode)
            : row,
        ),
      );
    },
    [onRowsChange, options, rows, workbookMode],
  );

  const updateRowPenetrations = useCallback(
    (rowId: string, penetrations: StructureWorkbookPenetration[]) => {
      onRowsChange(
        rows.map((row) => {
          if (row.id !== rowId) {
            return row;
          }
          const synced = syncRowFromPenetrations({ ...row, penetrations });
          return commitWorkbookRowPrice(synced, options, workbookMode);
        }),
      );
    },
    [onRowsChange, options, rows, workbookMode],
  );

  const updateRowOpenings = useCallback(
    (rowId: string, openings: StructureWorkbookOpeningRow[]) => {
      onRowsChange(
        rows.map((row) => {
          if (row.id !== rowId) {
            return row;
          }
          const synced = syncRowFromOpenings({ ...row, openings });
          return commitWorkbookRowPrice(synced, options, workbookMode);
        }),
      );
    },
    [onRowsChange, options, rows, workbookMode],
  );

  const handleTemplateChange = (
    row: StructureWorkbookRow,
    templateId: string,
  ) => {
    const template = options.templates.find((entry) => entry.id === templateId);
    patchRow(row.id, {
      templateId,
      diameterFeet: template?.diameters[0]
        ? String(template.diameters[0].insideDiameterFeet)
        : "",
      castingProductId: template?.defaultCastingProductId ?? "",
    });
  };

  const focusCell = (rowIndex: number, colIndex: number) => {
    const table = tableRef.current;
    if (!table) {
      return;
    }
    const selector = `[data-wb-row="${rowIndex}"][data-wb-col="${colIndex}"]`;
    const el = table.querySelector<HTMLElement>(selector);
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
      const nextCol =
        event.key === "ArrowLeft" ? colIndex - 1 : colIndex + 1;
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
    const pasted = applyTsvToRows([], tsvRows, options.templates, defaults);
    const committed = commitAllWorkbookRowPrices(pasted, options, workbookMode);
    onRowsChange([...rows, ...committed]);
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
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(rows.map((row) => row.id)));
    }
  };

  const mainColumnCount = 12;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table
        ref={tableRef}
        className="min-w-full text-left text-xs"
        onPaste={handlePaste}
      >
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
            <th className="w-8 px-2 py-2 font-semibold">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                title={allSelected ? "Deselect all rows" : "Select all rows"}
                className="rounded border-slate-300"
              />
            </th>
            <th className="px-2 py-2 font-semibold">Structure #</th>
            <th className="min-w-[8rem] px-2 py-2 font-semibold">Template</th>
            <th className="px-2 py-2 font-semibold">Dia (ft)</th>
            <th className="min-w-[8rem] px-2 py-2 font-semibold">Casting</th>
            <th className="px-2 py-2 font-semibold">Rim</th>
            <th className="px-2 py-2 font-semibold">Low Inv</th>
            <th className="w-14 px-2 py-2 font-semibold">Boots</th>
            <th className="w-14 px-2 py-2 font-semibold">Qty</th>
            <th className="px-2 py-2 font-semibold">Wall Ht</th>
            <th className="px-2 py-2 font-semibold">Unit Price</th>
            <th className="min-w-[8rem] px-2 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const template = options.templates.find(
              (entry) => entry.id === row.templateId,
            );
            const diameters = template?.diameters ?? [];
            const selected = selectedRowIds.has(row.id);
            const tone = groupToneClasses(rowIndex, selected);

            return (
              <Fragment key={row.id}>
                <tr className={tone.main}>
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleRowSelection(row.id)}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.structureNumber}
                      data-wb-row={rowIndex}
                      data-wb-col={0}
                      onChange={(event) =>
                        patchRow(row.id, {
                          structureNumber: event.target.value,
                        })
                      }
                      onBlur={() => commitRow(row.id)}
                      onKeyDown={(event) => handleCellKeyDown(event, rowIndex, 0)}
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={row.templateId}
                      data-wb-row={rowIndex}
                      data-wb-col={1}
                      onChange={(event) =>
                        handleTemplateChange(row, event.target.value)
                      }
                      onBlur={() => commitRow(row.id)}
                      onKeyDown={(event) => handleCellKeyDown(event, rowIndex, 1)}
                      className={structureTableInputClassName}
                    >
                      {options.templates.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={row.diameterFeet}
                      data-wb-row={rowIndex}
                      data-wb-col={2}
                      onChange={(event) =>
                        patchRow(row.id, { diameterFeet: event.target.value })
                      }
                      onBlur={() => commitRow(row.id)}
                      onKeyDown={(event) => handleCellKeyDown(event, rowIndex, 2)}
                      className={structureTableInputClassName}
                    >
                      <option value="">—</option>
                      {diameters.map((entry) => (
                        <option
                          key={entry.id}
                          value={String(entry.insideDiameterFeet)}
                        >
                          {entry.insideDiameterFeet}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={row.castingProductId}
                      data-wb-row={rowIndex}
                      data-wb-col={3}
                      onChange={(event) =>
                        patchRow(row.id, {
                          castingProductId: event.target.value,
                        })
                      }
                      onBlur={() => commitRow(row.id)}
                      onKeyDown={(event) => handleCellKeyDown(event, rowIndex, 3)}
                      className={structureTableInputClassName}
                    >
                      <option value="">— Default —</option>
                      {options.castings.map((casting) => (
                        <option key={casting.id} value={casting.id}>
                          {casting.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.rimElevation}
                      data-wb-row={rowIndex}
                      data-wb-col={4}
                      onChange={(event) =>
                        patchRow(row.id, { rimElevation: event.target.value })
                      }
                      onBlur={() => commitRow(row.id)}
                      onKeyDown={(event) => handleCellKeyDown(event, rowIndex, 4)}
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="px-2 py-1">
                    {isFullMode ? (
                      <span
                        className="block rounded border border-transparent px-2 py-1 text-slate-600"
                        title="Derived from the lowest opening invert"
                      >
                        {row.lowInvertElevation.trim() || "—"}
                      </span>
                    ) : (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.lowInvertElevation}
                        data-wb-row={rowIndex}
                        data-wb-col={5}
                        onChange={(event) =>
                          patchRow(row.id, {
                            lowInvertElevation: event.target.value,
                          })
                        }
                        onBlur={() => commitRow(row.id)}
                        onKeyDown={(event) =>
                          handleCellKeyDown(event, rowIndex, 5)
                        }
                        className={structureTableInputClassName}
                      />
                    )}
                  </td>
                  <td
                    className="px-2 py-1 text-slate-600"
                    title={
                      isFullMode
                        ? "Derived from openings below"
                        : "Derived from pipes below"
                    }
                  >
                    {row.bootCount.trim() || "0"}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.qty}
                      data-wb-row={rowIndex}
                      data-wb-col={qtyColIndex}
                      onChange={(event) =>
                        patchRow(row.id, { qty: event.target.value })
                      }
                      onBlur={() => commitRow(row.id)}
                      onKeyDown={(event) =>
                        handleCellKeyDown(event, rowIndex, qtyColIndex)
                      }
                      className={structureTableInputClassName}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-slate-600">
                    {row.wallHeightFeet != null
                      ? `${row.wallHeightFeet.toFixed(2)}'`
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 font-medium text-slate-900">
                    {row.unitPrice != null
                      ? formatQuoteCurrency(row.unitPrice)
                      : "—"}
                  </td>
                  <td
                    className={`max-w-[12rem] truncate px-2 py-1 ${
                      row.status === "OK" || row.status === "Drill sheet ready"
                        ? "text-emerald-600"
                        : row.structureConfig?.errorMessage
                          ? "text-red-600"
                          : "text-amber-600"
                    }`}
                    title={row.status}
                  >
                    {row.status || "—"}
                  </td>
                </tr>
                <tr className={`${tone.detail} border-b border-slate-200`}>
                  <td colSpan={mainColumnCount} className="p-0">
                    {isFullMode ? (
                      <RowOpeningsEditor
                        row={row}
                        options={options}
                        onOpeningsChange={(openings) =>
                          updateRowOpenings(row.id, openings)
                        }
                      />
                    ) : (
                      <RowPenetrationsEditor
                        row={row}
                        options={options}
                        onPenetrationsChange={(penetrations) =>
                          updateRowPenetrations(row.id, penetrations)
                        }
                      />
                    )}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function createInitialWorkbookRows(
  templates: DrillSheetTemplateOption[],
  count = 5,
  defaults?: StructureWorkbookDefaults,
): StructureWorkbookRow[] {
  const rows: StructureWorkbookRow[] = [];
  for (let index = 0; index < count; index += 1) {
    rows.push(createDefaultWorkbookRow(templates, rows, defaults));
  }
  return rows;
}
