"use client";

import {
  Fragment,
  useMemo,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { RECT_WALL_LABELS, RECT_WALLS, type RectWall } from "@/lib/rect-structure";
import {
  ONE_OFF_MAX_OPENINGS,
  ONE_OFF_MAX_ROWS,
  createRowFromSetup,
  nextFreeStructureNumber,
  openingLetter,
  openingPipe,
  resizeRowOpenings,
  setOpeningPipeType,
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

/** Width of each structure column, fixed so the grid stays compact. */
const STRUCTURE_COLUMN_PX = 64;
/** Width of the field-name column down the left. */
const LABEL_COLUMN_PX = 88;

const cellInputClassName =
  "block h-8 w-full min-w-0 border-0 bg-transparent px-1 text-[13px] text-slate-900 placeholder:text-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500";
const labelCellClassName =
  "sticky left-0 z-10 border-b border-r border-slate-300 bg-slate-50 px-2 text-left text-xs font-semibold text-slate-600";

type SelectOption = { value: string; label: string };

/**
 * One grid column. Every editable cell is described the same way so arrow
 * keys, Enter and multi-cell paste work across text and dropdown cells.
 */
type GridColumn = {
  key: string;
  header: string;
  kind: "text" | "select";
  numeric?: boolean;
  /** Numeric cells round to this many places when the cell is left. */
  decimals?: number;
  get: (row: OneOffRow) => string;
  set: (row: OneOffRow, value: string) => OneOffRow;
  options?: (row: OneOffRow) => SelectOption[];
  placeholder?: string;
  /** Starts a new group (each opening's fields) with a heading row. */
  groupStart?: boolean;
  groupLabel?: string;
  /** Long names (template, casting) wrap to two lines in the narrow cell. */
  wrap?: boolean;
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
  /** The row the sheet preview shows; clicking or typing in a row picks it. */
  activeRowId?: string | null;
  onActiveRowChange?: (rowId: string) => void;
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

/** How the grid is typed in; rendered above the grid so it can span the page. */
export function OneOffGridHint({ editMode = false }: { editMode?: boolean }) {
  return (
    <p className="text-[11px] text-slate-500">
      One column per structure, fields down the side. Enter moves down, Tab
      moves to the next structure, arrows move between cells, and a block
      copied from Excel (laid out the same way) pastes in. Rim and inverts
      round to two places and angles to whole degrees when you leave the cell.{" "}
      {editMode
        ? "Clearing an invert removes that opening from the sheet."
        : "Leave an invert blank for no pipe in that opening."}
    </p>
  );
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
  activeRowId = null,
  onActiveRowChange,
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
        get: (row) => row.structureNumber,
        set: (row, value) => ({ ...row, structureNumber: value }),
      },
      {
        key: "template",
        header: "Template",
        kind: "select",
        wrap: true,
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
        wrap: true,
        get: (row) => row.castingProductId,
        options: () => castingOptions,
        set: (row, value) => ({ ...row, castingProductId: value }),
      },
      {
        key: "rim",
        header: "Rim",
        kind: "text",
        numeric: true,
        decimals: 2,
        placeholder: "0.00",
        get: (row) => row.rimElevation,
        set: (row, value) => ({ ...row, rimElevation: value }),
      },
    );

    // Each inlet: invert, its own pipe (type and size), then angle (circular)
    // or wall (rect). Structures often take more than one kind of pipe.
    for (let index = 0; index < openingCount; index += 1) {
      const letter = openingLetter(index);
      result.push(
        {
          key: `inv-${index}`,
          header: `Inv ${letter}`,
          kind: "text",
          numeric: true,
          decimals: 2,
          placeholder: "0.00",
          groupStart: true,
          groupLabel: `Inlet ${letter}`,
          get: (row) => row.openings[index]?.invert ?? "",
          set: (row, value) => setOpening(row, index, { invert: value }),
        },
        // Both show the pipe the inlet will use, so a blank cell never
        // hides a fallback to the row's default.
        {
          key: `type-${index}`,
          header: `Type ${letter}`,
          kind: "select",
          get: (row) => {
            const cell = row.openings[index];
            return cell ? openingPipe(row, cell).pipeType : "";
          },
          options: () => pipeTypeOptions,
          set: (row, value) => setOpeningPipeType(row, index, value, pipeChoices),
        },
        {
          key: `size-${index}`,
          header: `Size ${letter}`,
          kind: "select",
          get: (row) => {
            const cell = row.openings[index];
            return cell ? openingPipe(row, cell).pipeSize : "";
          },
          options: (row) => {
            const cell = row.openings[index];
            const pipeType = cell ? openingPipe(row, cell).pipeType : "";
            return sizesForPipeType(pipeChoices, pipeType).map((size) => ({
              value: String(size),
              label: `${size}"`,
            }));
          },
          set: (row, value) => setOpening(row, index, { pipeSize: value }),
        },
      );
      if (isCircular) {
        result.push({
          key: `ang-${index}`,
          header: `Angle ${letter}`,
          kind: "text",
          numeric: true,
          decimals: 0,
          placeholder: "0",
          get: (row) => row.openings[index]?.angle ?? "",
          set: (row, value) => setOpening(row, index, { angle: value }),
        });
      } else {
        result.push({
          key: `wall-${index}`,
          header: `Wall ${letter}`,
          kind: "select",
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

  /** "15.025" becomes "15.03" in a 2-place cell; non-numbers are left alone. */
  function roundedValue(column: GridColumn, value: string): string {
    if (column.decimals == null) {
      return value;
    }
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    if (trimmed === "" || !Number.isFinite(parsed)) {
      return value;
    }
    const rounded = parsed.toFixed(column.decimals);
    return rounded === trimmed ? value : rounded;
  }

  function roundCell(rowIndex: number, column: GridColumn) {
    const row = rows[rowIndex];
    if (!row) {
      return;
    }
    const value = column.get(row);
    const rounded = roundedValue(column, value);
    if (rounded !== value) {
      patchCell(rowIndex, column, rounded);
    }
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

    // The grid is drawn sideways (fields down, structures across), so Enter
    // and up/down step through a structure's fields; left/right move to the
    // neighbouring structure.
    if (event.key === "Enter") {
      event.preventDefault();
      focusCell(rowIndex, event.shiftKey ? colIndex - 1 : colIndex + 1);
      return;
    }
    // Dropdowns keep their own up/down; text cells move like a spreadsheet.
    if (isInput && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      focusCell(rowIndex, event.key === "ArrowUp" ? colIndex - 1 : colIndex + 1);
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
        focusCell(event.key === "ArrowLeft" ? rowIndex - 1 : rowIndex + 1, colIndex);
      }
    }
  }

  /**
   * Excel-style paste for the sideways grid: a block copied from a
   * spreadsheet laid out the same way (fields down, structures across) fills
   * cells below and to the right of the one pasted into, adding structures
   * when it runs past the last column. Dropdown cells take a value whose text
   * matches one of their choices.
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
    const widest = block.reduce((max, cells) => Math.max(max, cells.length), 0);
    const next = [...rows];
    const numbers = [...allNumbers];
    while (
      !editMode &&
      next.length < rowIndex + widest &&
      next.length < ONE_OFF_MAX_ROWS
    ) {
      const added = newRow(numbers);
      numbers.push(added.structureNumber);
      next.push(added);
    }

    block.forEach((cells, fieldOffset) => {
      const column = columns[colIndex + fieldOffset];
      if (!column) {
        return;
      }
      cells.forEach((raw, structureOffset) => {
        const targetIndex = rowIndex + structureOffset;
        if (targetIndex >= next.length) {
          return;
        }
        const value = raw.trim();
        const row = next[targetIndex];
        if (column.kind === "text") {
          next[targetIndex] = column.set(row, roundedValue(column, value));
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
          next[targetIndex] = column.set(row, match.value);
        }
      });
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

  const tableWidth = LABEL_COLUMN_PX + STRUCTURE_COLUMN_PX * rows.length;

  /** Per-structure facts the read-only rows show. */
  const summaries = rows.map((row, rowIndex) => {
    const result = results[rowIndex];
    const isDuplicate = duplicateNumbers.has(
      row.structureNumber.trim().toLowerCase(),
    );
    const statusText = isDuplicate
      ? "Structure # is used twice or already on the job"
      : (result?.status ?? "");
    const tone: "ok" | "warn" | "error" | "idle" = isDuplicate
      ? "error"
      : result?.ready
        ? statusText === "Ready"
          ? "ok"
          : "warn"
        : "idle";
    return { result, isDuplicate, statusText, tone };
  });

  function structureCellClass(rowIndex: number, extra = ""): string {
    const row = rows[rowIndex];
    const active = activeRowId === row.id;
    const changed = changedRowIds?.has(row.id) ?? false;
    const tint = active ? "bg-sky-50" : changed ? "bg-amber-50/60" : "bg-white";
    return `border-b border-r border-slate-300 p-0 ${tint} ${extra}`;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
                ? `Clear the Inv ${openingLetter(openingCount - 1)} row first`
                : "Remove the last opening"
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

      <div className="max-w-full overflow-x-auto">
        <table
          ref={tableRef}
          className="border-separate border-spacing-0 rounded-lg border border-slate-300 text-left"
          style={{ width: tableWidth, tableLayout: "fixed" }}
        >
          <colgroup>
            <col style={{ width: LABEL_COLUMN_PX }} />
            {rows.map((row) => (
              <col key={row.id} style={{ width: STRUCTURE_COLUMN_PX }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                className={`${labelCellClassName} h-9 text-[10px] uppercase tracking-wide`}
              >
                #
              </th>
              {rows.map((row, rowIndex) => {
                const active = activeRowId === row.id;
                return (
                  <th
                    key={row.id}
                    onClick={() => onActiveRowChange?.(row.id)}
                    title={
                      active
                        ? "Previewing this structure"
                        : "Click to preview this structure"
                    }
                    className={`h-9 cursor-pointer border-b border-r border-slate-300 px-1 text-left text-[13px] font-semibold ${
                      active
                        ? "bg-sky-100 text-sky-800 shadow-[inset_0_3px_0_0_#0369a1]"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200/70"
                    }`}
                  >
                    {rowIndex + 1}
                    {active ? <span className="ml-1 text-sky-700">◂</span> : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {columns.map((column, colIndex) => {
              const groupRow = column.groupStart ? (
                <tr key={`group-${column.key}`}>
                  <td
                    colSpan={rows.length + 1}
                    className="sticky left-0 h-6 border-b border-slate-300 bg-slate-200 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-600"
                  >
                    {column.groupLabel}
                  </td>
                </tr>
              ) : null;
              return (
                <Fragment key={column.key}>
                  {groupRow}
                  <tr>
                    <th scope="row" className={`${labelCellClassName} h-8`}>
                      {column.header}
                    </th>
                    {rows.map((row, rowIndex) => {
                      const value = column.get(row);
                      const duplicateCell =
                        column.key === "structureNumber" &&
                        summaries[rowIndex].isDuplicate;
                      const cellClass = structureCellClass(
                        rowIndex,
                        duplicateCell ? "bg-red-50" : "",
                      );
                      const pick = () => onActiveRowChange?.(row.id);

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
                        const currentLabel =
                          options.find((option) => option.value === value)?.label ??
                          "";
                        const select = (
                          <select
                            value={value}
                            data-grid-row={rowIndex}
                            data-grid-col={colIndex}
                            title={currentLabel || undefined}
                            style={column.wrap ? { opacity: 0 } : undefined}
                            onChange={(event) =>
                              patchCell(rowIndex, column, event.target.value)
                            }
                            onKeyDown={(event) =>
                              handleKeyDown(event, rowIndex, colIndex)
                            }
                            className={
                              column.wrap
                                ? "absolute inset-0 h-full w-full cursor-pointer focus:outline-none"
                                : `${cellInputClassName} cursor-pointer pr-0 ${missing ? "bg-amber-50 text-amber-800" : ""}`
                            }
                          >
                            {missing ? <option value="">— pick —</option> : null}
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        );
                        if (column.wrap) {
                          // Native dropdowns can't wrap, so a two-line label
                          // sits under a transparent select that takes the
                          // clicks and keys.
                          return (
                            <td
                              key={row.id}
                              className={`${cellClass} relative focus-within:ring-2 focus-within:ring-inset focus-within:ring-sky-500`}
                              onFocusCapture={pick}
                              onClick={pick}
                            >
                              <div className="flex h-11 items-start gap-0.5 px-1 py-1">
                                <span
                                  className={`line-clamp-2 min-w-0 flex-1 break-words text-[11px] leading-[1.25] ${missing ? "text-amber-800" : "text-slate-900"}`}
                                >
                                  {currentLabel || "— pick —"}
                                </span>
                                <span aria-hidden="true" className="mt-0.5 text-[9px] text-slate-400">
                                  ▼
                                </span>
                              </div>
                              {select}
                            </td>
                          );
                        }
                        return (
                          <td
                            key={row.id}
                            className={cellClass}
                            onFocusCapture={pick}
                            onClick={pick}
                          >
                            {select}
                          </td>
                        );
                      }
                      return (
                        <td
                          key={row.id}
                          className={cellClass}
                          onFocusCapture={pick}
                          onClick={pick}
                        >
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
                            onBlur={() => roundCell(rowIndex, column)}
                            className={`${cellInputClassName} ${column.numeric ? "tabular-nums" : ""}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}

            <tr>
              <th scope="row" className={`${labelCellClassName} h-8`}>
                Wall Ht
              </th>
              {rows.map((row, rowIndex) => (
                <td
                  key={row.id}
                  onClick={() => onActiveRowChange?.(row.id)}
                  className={`${structureCellClass(rowIndex)} h-8 whitespace-nowrap px-1 text-[13px] font-medium tabular-nums text-slate-900`}
                >
                  {summaries[rowIndex].result?.wallHeightFeet != null
                    ? `${summaries[rowIndex].result?.wallHeightFeet?.toFixed(2)}'`
                    : "—"}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={`${labelCellClassName} h-8`}>
                Status
              </th>
              {rows.map((row, rowIndex) => {
                const { statusText, tone } = summaries[rowIndex];
                const dot =
                  tone === "ok"
                    ? "bg-emerald-500"
                    : tone === "warn"
                      ? "bg-amber-500"
                      : tone === "error"
                        ? "bg-red-500"
                        : "bg-slate-300";
                const text =
                  tone === "ok"
                    ? "text-emerald-700"
                    : tone === "warn"
                      ? "text-amber-700"
                      : tone === "error"
                        ? "text-red-600"
                        : "text-slate-500";
                return (
                  <td
                    key={row.id}
                    onClick={() => onActiveRowChange?.(row.id)}
                    title={statusText}
                    className={`${structureCellClass(rowIndex)} h-8 px-1 ${text}`}
                  >
                    <span className="flex items-center gap-1 overflow-hidden">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                      <span className="truncate text-[11px] font-semibold">
                        {statusText || "—"}
                      </span>
                    </span>
                  </td>
                );
              })}
            </tr>
            {editMode ? null : (
              <tr>
                <th scope="row" className={`${labelCellClassName} h-8`} />
                {rows.map((row, rowIndex) => (
                  <td
                    key={row.id}
                    className={`${structureCellClass(rowIndex)} h-8 whitespace-nowrap px-1`}
                  >
                    <button
                      type="button"
                      onClick={() => duplicateRow(rowIndex)}
                      title="Copy this structure to a new column"
                      className="mr-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(rowIndex)}
                      title="Remove this structure"
                      className="text-[11px] font-semibold text-red-600 hover:text-red-800"
                    >
                      ✕
                    </button>
                  </td>
                ))}
              </tr>
            )}
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
          + Add structure
        </button>
      )}
    </div>
  );
}
