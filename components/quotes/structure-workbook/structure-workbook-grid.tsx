"use client";

import {
  useCallback,
  useMemo,
  useRef,
  type KeyboardEvent,
} from "react";
import type { DrillSheetTemplateOption } from "@/components/drill-sheets/drill-sheet-form";
import { structureTableInputClassName } from "@/components/structures/structure-utils";
import { formatQuoteCurrency } from "@/components/quotes/quote-utils";
import {
  applyTsvToRows,
  commitAllWorkbookRowPrices,
  commitWorkbookRowPrice,
  createDefaultWorkbookRow,
  parseTsvPaste,
  type StructureWorkbookDefaults,
  type StructureWorkbookOptions,
  type StructureWorkbookRow,
} from "@/lib/quotes/structure-workbook";

const COLUMN_COUNT = 11;

type StructureWorkbookGridProps = {
  rows: StructureWorkbookRow[];
  options: StructureWorkbookOptions;
  defaults: StructureWorkbookDefaults;
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

function pipeTypesForMaterialSize(
  pipeOpeningSizes: StructureWorkbookOptions["pipeOpeningSizes"],
  material: string,
  size: number,
): string[] {
  return [
    ...new Set(
      pipeOpeningSizes
        .filter(
          (entry) =>
            entry.pipeMaterial === material &&
            Math.abs(entry.pipeSizeInches - size) < 1e-6,
        )
        .map((entry) => entry.pipeType),
    ),
  ].sort();
}

export function StructureWorkbookGrid({
  rows,
  options,
  defaults,
  selectedRowIds,
  onRowsChange,
  onSelectionChange,
}: StructureWorkbookGridProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  const pipeMaterials = useMemo(
    () => uniquePipeMaterials(options.pipeOpeningSizes),
    [options.pipeOpeningSizes],
  );

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
          row.id === rowId ? commitWorkbookRowPrice(row, options) : row,
        ),
      );
    },
    [onRowsChange, options, rows],
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
      if (nextCol >= 0 && nextCol < COLUMN_COUNT) {
        focusCell(rowIndex, nextCol);
      }
      return;
    }

    if (event.key === "Tab" || event.key === "Enter") {
      event.preventDefault();
      const direction = event.shiftKey ? -1 : 1;
      let nextCol = colIndex + direction;
      let nextRow = rowIndex;

      if (nextCol >= COLUMN_COUNT) {
        nextCol = 0;
        nextRow += 1;
      } else if (nextCol < 0) {
        nextCol = COLUMN_COUNT - 1;
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
    const committed = commitAllWorkbookRowPrices(pasted, options);
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

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table
        ref={tableRef}
        className="min-w-full text-left text-xs"
        onPaste={handlePaste}
      >
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
            <th className="w-8 px-2 py-2 font-semibold" />
            <th className="px-2 py-2 font-semibold">Structure #</th>
            <th className="min-w-[8rem] px-2 py-2 font-semibold">Template</th>
            <th className="px-2 py-2 font-semibold">Dia (ft)</th>
            <th className="min-w-[8rem] px-2 py-2 font-semibold">Casting</th>
            <th className="px-2 py-2 font-semibold">Rim</th>
            <th className="px-2 py-2 font-semibold">Low Inv</th>
            <th className="px-2 py-2 font-semibold">Material</th>
            <th className="px-2 py-2 font-semibold">Size</th>
            <th className="px-2 py-2 font-semibold">Type</th>
            <th className="w-14 px-2 py-2 font-semibold">Boots</th>
            <th className="w-14 px-2 py-2 font-semibold">Qty</th>
            <th className="px-2 py-2 font-semibold">Wall Ht</th>
            <th className="px-2 py-2 font-semibold">Unit Price</th>
            <th className="min-w-[8rem] px-2 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, rowIndex) => {
            const template = options.templates.find(
              (entry) => entry.id === row.templateId,
            );
            const diameters = template?.diameters ?? [];
            const sizes = pipeSizesForMaterial(
              options.pipeOpeningSizes,
              row.pipeMaterial,
            );
            const types = pipeTypesForMaterialSize(
              options.pipeOpeningSizes,
              row.pipeMaterial,
              Number(row.pipeSizeInches),
            );

            return (
              <tr
                key={row.id}
                className={
                  selectedRowIds.has(row.id) ? "bg-sky-50/60" : undefined
                }
              >
                <td className="px-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedRowIds.has(row.id)}
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
                    onKeyDown={(event) => handleCellKeyDown(event, rowIndex, 5)}
                    className={structureTableInputClassName}
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    value={row.pipeMaterial}
                    data-wb-row={rowIndex}
                    data-wb-col={6}
                    onChange={(event) =>
                      patchRow(row.id, {
                        pipeMaterial: event.target.value,
                        pipeSizeInches: "",
                        pipeType: "",
                      })
                    }
                    onBlur={() => commitRow(row.id)}
                    onKeyDown={(event) => handleCellKeyDown(event, rowIndex, 6)}
                    className={structureTableInputClassName}
                  >
                    <option value="">—</option>
                    {pipeMaterials.map((material) => (
                      <option key={material} value={material}>
                        {material}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <select
                    value={row.pipeSizeInches}
                    data-wb-row={rowIndex}
                    data-wb-col={7}
                    onChange={(event) =>
                      patchRow(row.id, {
                        pipeSizeInches: event.target.value,
                        pipeType: "",
                      })
                    }
                    onBlur={() => commitRow(row.id)}
                    onKeyDown={(event) => handleCellKeyDown(event, rowIndex, 7)}
                    className={structureTableInputClassName}
                  >
                    <option value="">—</option>
                    {sizes.map((size) => (
                      <option key={size} value={String(size)}>
                        {size}&quot;
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <select
                    value={row.pipeType}
                    data-wb-row={rowIndex}
                    data-wb-col={8}
                    onChange={(event) =>
                      patchRow(row.id, { pipeType: event.target.value })
                    }
                    onBlur={() => commitRow(row.id)}
                    onKeyDown={(event) => handleCellKeyDown(event, rowIndex, 8)}
                    className={structureTableInputClassName}
                  >
                    <option value="">—</option>
                    {types.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row.bootCount}
                    data-wb-row={rowIndex}
                    data-wb-col={9}
                    onChange={(event) =>
                      patchRow(row.id, { bootCount: event.target.value })
                    }
                    onBlur={() => commitRow(row.id)}
                    onKeyDown={(event) => handleCellKeyDown(event, rowIndex, 9)}
                    className={structureTableInputClassName}
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.qty}
                    data-wb-row={rowIndex}
                    data-wb-col={10}
                    onChange={(event) =>
                      patchRow(row.id, { qty: event.target.value })
                    }
                    onBlur={() => commitRow(row.id)}
                    onKeyDown={(event) =>
                      handleCellKeyDown(event, rowIndex, 10)
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
                    row.status === "OK"
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
