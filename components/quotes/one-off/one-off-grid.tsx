"use client";

import { useMemo, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { RECT_WALL_LABELS, RECT_WALLS, type RectWall } from "@/lib/rect-structure";
import {
  ONE_OFF_MAX_OPENINGS,
  ONE_OFF_MAX_ROWS,
  createRowFromSetup,
  nextFreeStructureNumber,
  openingLetter,
  resizeRowOpenings,
  sizesForPipeType,
  type OneOffCircularOptions,
  type OneOffRectOptions,
  type OneOffRow,
  type OneOffRowResult,
  type OneOffSetup,
  type OneOffShape,
  type PipeTypeChoice,
} from "@/lib/quotes/one-off-drill-sheets";
import { parseTsvPaste, createRowId } from "@/lib/quotes/structure-workbook";
import {
  tableCellInputClassName,
  tableClassName,
  tableGridCellClassName,
  tableHeaderCellClassName,
  tableNumericCellInputClassName,
  tableRowNumberCellClassName,
  tableWrapperClassName,
} from "@/lib/table-styles";

type SelectOption = { value: string; label: string };

/**
 * One grid column. Every editable cell is described the same way so arrow
 * keys, Enter and multi-cell paste work across text and dropdown cells.
 */
type GridColumn = {
  key: string;
  header: string;
  kind: "text" | "select";
  className?: string;
  numeric?: boolean;
  get: (row: OneOffRow) => string;
  set: (row: OneOffRow, value: string) => OneOffRow;
  options?: (row: OneOffRow) => SelectOption[];
  placeholder?: string;
  /** Visually starts a new group (each opening's columns). */
  groupStart?: boolean;
};

type OneOffGridProps = {
  shape: OneOffShape;
  rows: OneOffRow[];
  results: OneOffRowResult[];
  openingCount: number;
  setup: OneOffSetup;
  pipeChoices: PipeTypeChoice[];
  /** Structure numbers used elsewhere (the job, the other grid). */
  takenNumbers: string[];
  duplicateNumbers: Set<string>;
  circularOptions: OneOffCircularOptions;
  rectOptions: OneOffRectOptions;
  onRowsChange: (rows: OneOffRow[]) => void;
  onOpeningCountChange: (count: number) => void;
  /**
   * Editing saved sheets: rows can't be added, copied or removed, and
   * `changedRowIds` marks the rows that will be saved.
   */
  editMode?: boolean;
  changedRowIds?: Set<string>;
};

function setOpening(
  row: OneOffRow,
  index: number,
  patch: Partial<OneOffRow["openings"][number]>,
): OneOffRow {
  return {
    ...row,
    openings: row.openings.map((cell, cellIndex) =>
      cellIndex === index ? { ...cell, ...patch } : cell,
    ),
  };
}

export function OneOffGrid({
  shape,
  rows,
  results,
  openingCount,
  setup,
  pipeChoices,
  takenNumbers,
  duplicateNumbers,
  circularOptions,
  rectOptions,
  onRowsChange,
  onOpeningCountChange,
  editMode = false,
  changedRowIds,
}: OneOffGridProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const isCircular = shape === "CIRCULAR";

  const columns = useMemo<GridColumn[]>(() => {
    const templateOptions: SelectOption[] = (
      isCircular ? circularOptions.templates : rectOptions.templates
    ).map((template) => ({ value: template.id, label: template.name }));
    const castingOptions: SelectOption[] = (
      isCircular ? circularOptions.castings : rectOptions.castings
    ).map((casting) => ({ value: casting.id, label: casting.name }));
    const pipeTypeOptions: SelectOption[] = pipeChoices.map((choice) => ({
      value: choice.label,
      label: choice.label,
    }));

    const result: GridColumn[] = [
      {
        key: "structureNumber",
        header: "Structure #",
        kind: "text",
        className: "min-w-[6.5rem]",
        get: (row) => row.structureNumber,
        set: (row, value) => ({ ...row, structureNumber: value }),
      },
      {
        key: "template",
        header: "Template",
        kind: "select",
        className: "min-w-[10rem]",
        get: (row) => row.templateId,
        options: () => templateOptions,
        set: (row, value) => {
          if (!isCircular) {
            if (row.insideLengthFeet === undefined || value === row.templateId) {
              return { ...row, templateId: value };
            }
            // A saved sheet moved to another template takes its size.
            const preset = rectOptions.templates.find(
              (entry) => entry.id === value,
            )?.presetSizes[0];
            return {
              ...row,
              templateId: value,
              insideLengthFeet: preset ? String(preset.insideLengthFeet) : "",
              insideWidthFeet: preset ? String(preset.insideWidthFeet) : "",
            };
          }
          const template = circularOptions.templates.find(
            (entry) => entry.id === value,
          );
          const diameters = template?.diameters ?? [];
          const keepDiameter = diameters.some(
            (entry) => String(entry.insideDiameterFeet) === row.diameterFeet,
          );
          return {
            ...row,
            templateId: value,
            diameterFeet: keepDiameter
              ? row.diameterFeet
              : diameters[0]
                ? String(diameters[0].insideDiameterFeet)
                : "",
          };
        },
      },
    ];

    if (isCircular) {
      result.push({
        key: "diameter",
        header: "Dia (ft)",
        kind: "select",
        className: "min-w-[4.5rem]",
        get: (row) => row.diameterFeet,
        options: (row) =>
          (
            circularOptions.templates.find((entry) => entry.id === row.templateId)
              ?.diameters ?? []
          ).map((entry) => ({
            value: String(entry.insideDiameterFeet),
            label: `${entry.insideDiameterFeet}'`,
          })),
        set: (row, value) => ({ ...row, diameterFeet: value }),
      });
    }

    result.push(
      {
        key: "casting",
        header: "Casting",
        kind: "select",
        className: "min-w-[10rem]",
        get: (row) => row.castingProductId,
        options: () => castingOptions,
        set: (row, value) => ({ ...row, castingProductId: value }),
      },
      {
        key: "pipeType",
        header: "Pipe Type",
        kind: "select",
        className: "min-w-[8rem]",
        get: (row) => row.pipeType,
        options: () => pipeTypeOptions,
        set: (row, value) => {
          const sizes = sizesForPipeType(pipeChoices, value);
          const keepSize = sizes.some((size) => String(size) === row.pipeSize);
          return { ...row, pipeType: value, pipeSize: keepSize ? row.pipeSize : "" };
        },
      },
      {
        key: "pipeSize",
        header: "Pipe Size",
        kind: "select",
        className: "min-w-[4.5rem]",
        get: (row) => row.pipeSize,
        options: (row) =>
          sizesForPipeType(pipeChoices, row.pipeType).map((size) => ({
            value: String(size),
            label: `${size}"`,
          })),
        set: (row, value) => ({ ...row, pipeSize: value }),
      },
      {
        key: "rim",
        header: "Rim",
        kind: "text",
        numeric: true,
        className: "min-w-[5.5rem]",
        placeholder: "0.00",
        get: (row) => row.rimElevation,
        set: (row, value) => ({ ...row, rimElevation: value }),
      },
    );

    for (let index = 0; index < openingCount; index += 1) {
      const letter = openingLetter(index);
      result.push({
        key: `inv-${index}`,
        header: `Inv ${letter}`,
        kind: "text",
        numeric: true,
        className: "min-w-[5.5rem]",
        placeholder: "0.00",
        groupStart: true,
        get: (row) => row.openings[index]?.invert ?? "",
        set: (row, value) => setOpening(row, index, { invert: value }),
      });
      if (isCircular) {
        result.push({
          key: `ang-${index}`,
          header: `Angle ${letter}`,
          kind: "text",
          numeric: true,
          className: "min-w-[4rem]",
          placeholder: "0",
          get: (row) => row.openings[index]?.angle ?? "",
          set: (row, value) => setOpening(row, index, { angle: value }),
        });
      } else {
        result.push({
          key: `wall-${index}`,
          header: `Wall ${letter}`,
          kind: "select",
          className: "min-w-[5rem]",
          get: (row) => row.openings[index]?.wall ?? "UP",
          options: () =>
            RECT_WALLS.map((wall) => ({
              value: wall,
              label: RECT_WALL_LABELS[wall],
            })),
          set: (row, value) =>
            RECT_WALLS.includes(value as RectWall)
              ? setOpening(row, index, { wall: value as RectWall })
              : row,
        });
      }
    }

    return result;
  }, [
    circularOptions,
    isCircular,
    openingCount,
    pipeChoices,
    rectOptions,
  ]);

  const allNumbers = useMemo(
    () => [...takenNumbers, ...rows.map((row) => row.structureNumber)],
    [rows, takenNumbers],
  );

  function newRow(existing: string[]): OneOffRow {
    const number = nextFreeStructureNumber(setup.prefix, existing);
    return createRowFromSetup(setup, `${setup.prefix}${number}`, openingCount);
  }

  function patchCell(rowIndex: number, column: GridColumn, value: string) {
    onRowsChange(
      rows.map((row, index) =>
        index === rowIndex ? column.set(row, value) : row,
      ),
    );
  }

  function focusCell(rowIndex: number, colIndex: number) {
    const el = tableRef.current?.querySelector<HTMLElement>(
      `[data-grid-row="${rowIndex}"][data-grid-col="${colIndex}"]`,
    );
    el?.focus();
    if (el instanceof HTMLInputElement) {
      el.select();
    }
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIndex: number,
    colIndex: number,
  ) {
    const target = event.currentTarget;
    const isInput = target instanceof HTMLInputElement;

    if (event.key === "Enter") {
      event.preventDefault();
      focusCell(event.shiftKey ? rowIndex - 1 : rowIndex + 1, colIndex);
      return;
    }
    // Dropdowns keep their own up/down; text cells move like a spreadsheet.
    if (isInput && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      focusCell(event.key === "ArrowUp" ? rowIndex - 1 : rowIndex + 1, colIndex);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const atEdge = !isInput
        ? true
        : event.key === "ArrowLeft"
          ? target.selectionStart === 0 && target.selectionEnd === 0
          : target.selectionStart === target.value.length;
      if (atEdge) {
        event.preventDefault();
        focusCell(rowIndex, event.key === "ArrowLeft" ? colIndex - 1 : colIndex + 1);
      }
    }
  }

  /**
   * Excel-style paste: a block copied from a spreadsheet fills cells to the
   * right and below the one pasted into, adding rows when it runs past the
   * bottom. Dropdown cells take a value whose text matches one of their
   * choices.
   */
  function handlePaste(
    event: ClipboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number,
  ) {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) {
      return;
    }
    event.preventDefault();

    const block = parseTsvPaste(text);
    const next = [...rows];
    const numbers = [...allNumbers];
    while (
      !editMode &&
      next.length < rowIndex + block.length &&
      next.length < ONE_OFF_MAX_ROWS
    ) {
      const added = newRow(numbers);
      numbers.push(added.structureNumber);
      next.push(added);
    }

    block.forEach((cells, offset) => {
      const targetIndex = rowIndex + offset;
      if (targetIndex >= next.length) {
        return;
      }
      let row = next[targetIndex];
      cells.forEach((raw, cellOffset) => {
        const column = columns[colIndex + cellOffset];
        const value = raw.trim();
        if (!column) {
          return;
        }
        if (column.kind === "text") {
          row = column.set(row, value);
          return;
        }
        const wanted = value.toLowerCase().replace(/["']/g, "");
        const match = column
          .options?.(row)
          .find(
            (option) =>
              option.value.toLowerCase() === wanted ||
              option.label.toLowerCase().replace(/["']/g, "") === wanted,
          );
        if (match) {
          row = column.set(row, match.value);
        }
      });
      next[targetIndex] = row;
    });

    onRowsChange(next);
  }

  function addRow() {
    if (rows.length >= ONE_OFF_MAX_ROWS) {
      return;
    }
    onRowsChange([...rows, newRow(allNumbers)]);
  }

  function duplicateRow(rowIndex: number) {
    if (rows.length >= ONE_OFF_MAX_ROWS) {
      return;
    }
    const source = rows[rowIndex];
    const number = nextFreeStructureNumber(setup.prefix, allNumbers);
    const copy: OneOffRow = {
      ...source,
      id: createRowId(),
      structureNumber: `${setup.prefix}${number}`,
      openings: source.openings.map((cell) => ({ ...cell })),
    };
    onRowsChange([
      ...rows.slice(0, rowIndex + 1),
      copy,
      ...rows.slice(rowIndex + 1),
    ]);
  }

  function removeRow(rowIndex: number) {
    onRowsChange(rows.filter((_, index) => index !== rowIndex));
  }

  function changeOpeningCount(count: number) {
    const clamped = Math.min(ONE_OFF_MAX_OPENINGS, Math.max(1, count));
    onOpeningCountChange(clamped);
    onRowsChange(resizeRowOpenings(rows, clamped));
  }

  const lastOpeningHasData = rows.some(
    (row) => (row.openings[openingCount - 1]?.invert ?? "").trim() !== "",
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">
          Type like a spreadsheet: Enter moves down, arrows move between cells,
          and you can paste a block copied from Excel.{" "}
          {editMode
            ? "Clearing an invert removes that opening from the sheet."
            : "Leave an invert blank for no pipe in that opening."}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-600">
            Openings: {openingCount}
          </span>
          <button
            type="button"
            onClick={() => changeOpeningCount(openingCount - 1)}
            disabled={openingCount <= 1 || lastOpeningHasData}
            title={
              lastOpeningHasData
                ? `Clear the Inv ${openingLetter(openingCount - 1)} column first`
                : "Remove the last opening column"
            }
            className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            − Opening
          </button>
          <button
            type="button"
            onClick={() => changeOpeningCount(openingCount + 1)}
            disabled={openingCount >= ONE_OFF_MAX_OPENINGS}
            className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            + Opening
          </button>
        </div>
      </div>

      <div className={tableWrapperClassName}>
        <table ref={tableRef} className={tableClassName}>
          <thead>
            <tr>
              <th className={`${tableHeaderCellClassName} w-10 text-center`}>#</th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${tableHeaderCellClassName} ${column.numeric ? "text-right" : ""} ${column.groupStart ? "border-l-2 border-l-slate-300" : ""}`}
                >
                  {column.header}
                </th>
              ))}
              <th className={`${tableHeaderCellClassName} text-right`}>Wall Ht</th>
              <th className={`${tableHeaderCellClassName} min-w-[12rem]`}>Status</th>
              {editMode ? null : (
                <th className={`${tableHeaderCellClassName} w-16`} />
              )}
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((row, rowIndex) => {
              const result = results[rowIndex];
              const isDuplicate = duplicateNumbers.has(
                row.structureNumber.trim().toLowerCase(),
              );
              const statusText = isDuplicate
                ? "Structure # is used twice or already on the job"
                : (result?.status ?? "");
              const statusClass = isDuplicate
                ? "text-red-600"
                : result?.ready
                  ? statusText === "Ready"
                    ? "text-emerald-700"
                    : "text-amber-700"
                  : "text-slate-500";

              const changed = changedRowIds?.has(row.id) ?? false;

              return (
                <tr
                  key={row.id}
                  className={changed ? "bg-amber-50/60" : "hover:bg-sky-50/40"}
                  title={changed ? "Changed: saved when you click Save" : undefined}
                >
                  <td className={tableRowNumberCellClassName}>{rowIndex + 1}</td>
                  {columns.map((column, colIndex) => {
                    const value = column.get(row);
                    const cellClass = `${tableGridCellClassName} ${column.className ?? ""} ${column.groupStart ? "border-l-2 border-l-slate-300" : ""} ${
                      column.key === "structureNumber" && isDuplicate
                        ? "bg-red-50"
                        : ""
                    }`;
                    if (column.kind === "select") {
                      const listed = column.options?.(row) ?? [];
                      const missing = value === "";
                      // A saved sheet can hold a value no longer offered.
                      const options =
                        missing || listed.some((option) => option.value === value)
                          ? listed
                          : [
                              {
                                value,
                                label:
                                  column.key === "template" ||
                                  column.key === "casting"
                                    ? "(no longer offered)"
                                    : value,
                              },
                              ...listed,
                            ];
                      return (
                        <td key={column.key} className={cellClass}>
                          <select
                            value={value}
                            data-grid-row={rowIndex}
                            data-grid-col={colIndex}
                            onChange={(event) =>
                              patchCell(rowIndex, column, event.target.value)
                            }
                            onKeyDown={(event) =>
                              handleKeyDown(event, rowIndex, colIndex)
                            }
                            className={`${tableCellInputClassName} ${missing ? "bg-amber-50 text-amber-800" : ""}`}
                          >
                            {missing ? <option value="">— pick —</option> : null}
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    }
                    return (
                      <td key={column.key} className={cellClass}>
                        <input
                          type="text"
                          inputMode={column.numeric ? "decimal" : undefined}
                          value={value}
                          placeholder={column.placeholder}
                          data-grid-row={rowIndex}
                          data-grid-col={colIndex}
                          onChange={(event) =>
                            patchCell(rowIndex, column, event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleKeyDown(event, rowIndex, colIndex)
                          }
                          onPaste={(event) =>
                            handlePaste(event, rowIndex, colIndex)
                          }
                          className={
                            column.numeric
                              ? tableNumericCellInputClassName
                              : tableCellInputClassName
                          }
                        />
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap border-b border-r border-slate-300 bg-slate-50/60 px-2 py-1.5 text-right tabular-nums font-medium text-slate-900">
                    {result?.wallHeightFeet != null
                      ? `${result.wallHeightFeet.toFixed(2)}'`
                      : "—"}
                  </td>
                  <td
                    className={`max-w-[18rem] truncate border-b border-r border-slate-300 px-2 py-1.5 ${statusClass}`}
                    title={statusText}
                  >
                    {statusText || "—"}
                  </td>
                  {editMode ? null : (
                    <td className="whitespace-nowrap border-b border-slate-300 px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => duplicateRow(rowIndex)}
                        title="Copy this row below"
                        className="mr-2 text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(rowIndex)}
                        title="Remove this row"
                        className="text-[11px] font-semibold text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editMode ? null : (
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= ONE_OFF_MAX_ROWS}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40"
        >
          + Add row
        </button>
      )}
    </div>
  );
}
