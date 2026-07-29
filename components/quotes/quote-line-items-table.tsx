"use client";

import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  type EditableQuoteLineItem,
  formatQuoteCurrency,
  getLineItemTotal,
  isCategoryLineItem,
} from "@/components/quotes/quote-utils";
import { hasCostBreakdown } from "@/lib/quotes/custom-structure";
import { RichTextContent } from "@/components/ui/rich-text-content";
import {
  tableBodyClassName,
  tableCellBordersClassName,
  tableCellClassName,
  tableCellInputClassName,
  tableCellTextareaClassName,
  tableClassName,
  tableComputedCellClassName,
  tableGridCellClassName,
  tableHeaderCellClassName,
  tableNumericCellInputClassName,
  tableRowClassName,
  tableRowNumberCellClassName,
  tableWrapperClassName,
} from "@/lib/table-styles";

const iconButtonClassName =
  "inline-flex h-6 w-6 items-center justify-center rounded text-[13px] text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30";

// Keyboard-navigable columns, in Tab/Enter order.
// Description=0, Qty=1, Unit=2, Unit Price=3, Weight=4, Tax=5.
// Rows expose only the columns that are editable for them (category rows only
// col 0; custom structures skip cols 0 and 3), so navigation skips the gaps.
const NAV_COLUMN_COUNT = 6;

type CellKeyDownHandler = (
  event: KeyboardEvent<HTMLElement>,
  rowIndex: number,
  colIndex: number,
) => void;

function autoResizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) {
    return;
  }
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function QuoteLineDescriptionTextarea({
  value,
  onChange,
  className,
  rowIndex,
  onCellKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  rowIndex: number;
  onCellKeyDown: CellKeyDownHandler;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    autoResizeTextarea(ref.current);
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      data-qli-row={rowIndex}
      data-qli-col={0}
      onKeyDown={(event) => onCellKeyDown(event, rowIndex, 0)}
      onChange={(event) => {
        onChange(event.target.value);
        autoResizeTextarea(event.target);
      }}
      className={className ?? tableCellTextareaClassName}
    />
  );
}

/** Formats a raw price string as currency ($1,234.50) when it parses. */
function formatUnitPriceDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? formatQuoteCurrency(parsed) : value;
}

/**
 * Unit-price cell: shows the currency-formatted value at rest (matching the
 * Total column, minus the bold) and the raw number while editing.
 */
function QuoteUnitPriceInput({
  value,
  onChange,
  rowIndex,
  onCellKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  rowIndex: number;
  onCellKeyDown: CellKeyDownHandler;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      type="text"
      value={focused ? value : formatUnitPriceDisplay(value)}
      data-qli-row={rowIndex}
      data-qli-col={3}
      onKeyDown={(event) => onCellKeyDown(event, rowIndex, 3)}
      onFocus={(event) => {
        setFocused(true);
        // Re-select after the raw value replaces the formatted one.
        const target = event.currentTarget;
        requestAnimationFrame(() => target.select());
      }}
      onBlur={() => setFocused(false)}
      onChange={(event) => onChange(event.target.value)}
      className={tableNumericCellInputClassName}
    />
  );
}

export type QuoteLineItemsTableProps = {
  lineItems: EditableQuoteLineItem[];
  onUpdateLine: (
    id: string,
    field: keyof EditableQuoteLineItem,
    value: string | boolean,
  ) => void;
  onRemoveLine: (id: string) => void;
  onMoveLine: (id: string, direction: "up" | "down") => void;
  /** Place the line at an exact index (drag-drop / jump-to-position). */
  onMoveLineTo: (id: string, targetIndex: number) => void;
  onEditCustomStructure: (line: EditableQuoteLineItem) => void;
};

type RowDragHandlers = {
  onHandleDragStart: (
    event: DragEvent<HTMLElement>,
    rowIndex: number,
    lineId: string,
  ) => void;
  onHandleDragEnd: () => void;
  onRowDragOver: (event: DragEvent<HTMLElement>, rowIndex: number) => void;
  onRowDrop: (event: DragEvent<HTMLElement>, rowIndex: number) => void;
};

type QuoteLineItemRowProps = {
  line: EditableQuoteLineItem;
  rowIndex: number;
  rowCount: number;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  /** Drop indicator edge while a drag hovers this row. */
  dropEdge: "top" | "bottom" | null;
  dragHandlers: RowDragHandlers;
  onUpdateLine: QuoteLineItemsTableProps["onUpdateLine"];
  onRemoveLine: QuoteLineItemsTableProps["onRemoveLine"];
  onMoveLine: QuoteLineItemsTableProps["onMoveLine"];
  onMoveLineTo: QuoteLineItemsTableProps["onMoveLineTo"];
  onEditCustomStructure: QuoteLineItemsTableProps["onEditCustomStructure"];
  onCellKeyDown: CellKeyDownHandler;
};

function DragHandleCell({
  line,
  rowIndex,
  dragHandlers,
}: Pick<QuoteLineItemRowProps, "line" | "rowIndex" | "dragHandlers">) {
  return (
    <td className={`${tableCellBordersClassName} w-6 px-0.5 py-1 text-center`}>
      <span
        draggable
        onDragStart={(event) =>
          dragHandlers.onHandleDragStart(event, rowIndex, line.id)
        }
        onDragEnd={dragHandlers.onHandleDragEnd}
        title="Drag to reorder"
        aria-label={`Drag line ${line.lineNumber} to reorder`}
        className="inline-flex h-6 w-4 cursor-grab select-none items-center justify-center rounded text-[13px] leading-none text-slate-300 hover:bg-slate-200/70 hover:text-slate-600 active:cursor-grabbing"
      >
        ⋮⋮
      </span>
    </td>
  );
}

/**
 * The row-number cell doubles as "move to position": click it, type the
 * target line number, Enter. Precision tool for long quotes where dragging
 * across pages of rows is tedious.
 */
function LineNumberCell({
  line,
  rowCount,
  onMoveLineTo,
}: Pick<QuoteLineItemRowProps, "line" | "rowCount" | "onMoveLineTo">) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  if (!editing) {
    return (
      <td
        className={`${tableRowNumberCellClassName} cursor-pointer hover:bg-sky-50 hover:text-sky-700`}
        title="Click to type a new position for this line"
        onClick={() => {
          setValue(String(line.lineNumber));
          setEditing(true);
        }}
      >
        {line.lineNumber}
      </td>
    );
  }

  const commit = () => {
    setEditing(false);
    const target = Number.parseInt(value, 10);
    if (Number.isFinite(target)) {
      onMoveLineTo(line.id, Math.max(0, Math.min(rowCount - 1, target - 1)));
    }
  };

  return (
    <td className={`${tableRowNumberCellClassName} p-0`}>
      <input
        autoFocus
        type="text"
        inputMode="numeric"
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            setEditing(false);
          }
        }}
        onBlur={() => setEditing(false)}
        aria-label={`Move line ${line.lineNumber} to position`}
        className="h-full w-full border-0 bg-white px-1 py-1.5 text-center text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500"
      />
    </td>
  );
}

/** Drop-indicator / drag styling for a row while a drag is in flight. */
function rowDragClassName(
  isDragging: boolean,
  dropEdge: "top" | "bottom" | null,
): string {
  return [
    isDragging ? "opacity-40" : "",
    dropEdge === "top"
      ? "[&>td]:border-t-2 [&>td]:!border-t-sky-500"
      : "",
    dropEdge === "bottom"
      ? "[&>td]:!border-b-2 [&>td]:!border-b-sky-500"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function MoveRemoveButtons({
  line,
  isFirst,
  isLast,
  onRemoveLine,
  onMoveLine,
  onEditCustomStructure,
}: Pick<
  QuoteLineItemRowProps,
  | "line"
  | "isFirst"
  | "isLast"
  | "onRemoveLine"
  | "onMoveLine"
  | "onEditCustomStructure"
>) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onMoveLine(line.id, "up")}
        disabled={isFirst}
        className={iconButtonClassName}
        aria-label={`Move line ${line.lineNumber} up`}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onMoveLine(line.id, "down")}
        disabled={isLast}
        className={iconButtonClassName}
        aria-label={`Move line ${line.lineNumber} down`}
      >
        ↓
      </button>
      {line.type === "CUSTOM_STRUCTURE" ? (
        <button
          type="button"
          onClick={() => onEditCustomStructure(line)}
          className={iconButtonClassName}
          aria-label={`Edit custom structure on line ${line.lineNumber}`}
        >
          ✎
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onRemoveLine(line.id)}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-[13px] text-red-500 hover:bg-red-50 hover:text-red-700"
        aria-label={`Remove line ${line.lineNumber}`}
      >
        ✕
      </button>
    </div>
  );
}

const QuoteLineItemRow = memo(function QuoteLineItemRow({
  line,
  rowIndex,
  rowCount,
  isFirst,
  isLast,
  isDragging,
  dropEdge,
  dragHandlers,
  onUpdateLine,
  onRemoveLine,
  onMoveLine,
  onMoveLineTo,
  onEditCustomStructure,
  onCellKeyDown,
}: QuoteLineItemRowProps) {
  const rowProps = {
    className: `${tableRowClassName} ${rowDragClassName(isDragging, dropEdge)}`,
    onDragOver: (event: DragEvent<HTMLElement>) =>
      dragHandlers.onRowDragOver(event, rowIndex),
    onDrop: (event: DragEvent<HTMLElement>) =>
      dragHandlers.onRowDrop(event, rowIndex),
  };

  if (line.type === "PAGE_BREAK") {
    return (
      <tr {...rowProps}>
        <DragHandleCell
          line={line}
          rowIndex={rowIndex}
          dragHandlers={dragHandlers}
        />
        <LineNumberCell
          line={line}
          rowCount={rowCount}
          onMoveLineTo={onMoveLineTo}
        />
        <td className={tableCellClassName}>
          <StatusBadge label={line.typeLabel} variant="neutral" />
        </td>
        <td className={`${tableCellBordersClassName} px-2`} colSpan={8}>
          <div className="flex items-center gap-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            <span className="h-0 flex-1 border-t-2 border-dashed border-slate-300" />
            Everything below starts on a new page
            <span className="h-0 flex-1 border-t-2 border-dashed border-slate-300" />
          </div>
        </td>
        <td className={`${tableCellBordersClassName} px-1.5 py-1`}>
          <MoveRemoveButtons
            line={line}
            isFirst={isFirst}
            isLast={isLast}
            onRemoveLine={onRemoveLine}
            onMoveLine={onMoveLine}
            onEditCustomStructure={onEditCustomStructure}
          />
        </td>
      </tr>
    );
  }

  if (isCategoryLineItem(line.type) || line.type === "NOTE") {
    return (
      <tr {...rowProps}>
        <DragHandleCell
          line={line}
          rowIndex={rowIndex}
          dragHandlers={dragHandlers}
        />
        <LineNumberCell
          line={line}
          rowCount={rowCount}
          onMoveLineTo={onMoveLineTo}
        />
        <td className={tableCellClassName}>
          <StatusBadge label={line.typeLabel} variant="neutral" />
        </td>
        <td className={`${tableGridCellClassName} bg-slate-50/60`} colSpan={8}>
          <QuoteLineDescriptionTextarea
            value={line.description}
            onChange={(value) => onUpdateLine(line.id, "description", value)}
            className={`${tableCellTextareaClassName} ${
              isCategoryLineItem(line.type) ? "font-medium" : ""
            }`}
            rowIndex={rowIndex}
            onCellKeyDown={onCellKeyDown}
          />
        </td>
        <td className={`${tableCellBordersClassName} px-1.5 py-1`}>
          <MoveRemoveButtons
            line={line}
            isFirst={isFirst}
            isLast={isLast}
            onRemoveLine={onRemoveLine}
            onMoveLine={onMoveLine}
            onEditCustomStructure={onEditCustomStructure}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr {...rowProps}>
      <DragHandleCell
        line={line}
        rowIndex={rowIndex}
        dragHandlers={dragHandlers}
      />
      <LineNumberCell
        line={line}
        rowCount={rowCount}
        onMoveLineTo={onMoveLineTo}
      />
      <td className={tableCellClassName}>
        <StatusBadge label={line.typeLabel} variant="neutral" />
      </td>
      <td
        className={`${tableCellClassName} whitespace-nowrap font-medium text-slate-900`}
      >
        {line.item}
      </td>
      <td className={`${tableGridCellClassName} min-w-[18rem]`}>
        {line.type === "CUSTOM_STRUCTURE" ? (
          <RichTextContent
            value={line.description}
            className="px-2 py-1.5 text-sm leading-snug text-slate-600"
          />
        ) : (
          <QuoteLineDescriptionTextarea
            value={line.description}
            onChange={(value) => onUpdateLine(line.id, "description", value)}
            rowIndex={rowIndex}
            onCellKeyDown={onCellKeyDown}
          />
        )}
      </td>
      <td className={tableGridCellClassName}>
        <input
          type="text"
          value={line.qty}
          data-qli-row={rowIndex}
          data-qli-col={1}
          onKeyDown={(event) => onCellKeyDown(event, rowIndex, 1)}
          onChange={(event) =>
            onUpdateLine(line.id, "qty", event.target.value)
          }
          className={tableNumericCellInputClassName}
        />
      </td>
      <td className={tableGridCellClassName}>
        <input
          type="text"
          value={line.unit}
          data-qli-row={rowIndex}
          data-qli-col={2}
          onKeyDown={(event) => onCellKeyDown(event, rowIndex, 2)}
          onChange={(event) =>
            onUpdateLine(line.id, "unit", event.target.value)
          }
          className={tableCellInputClassName}
        />
      </td>
      {line.type === "CUSTOM_STRUCTURE" && hasCostBreakdown(line.costBreakdown) ? (
        <td className={`${tableCellClassName} text-right`}>
          <p className="tabular-nums text-slate-900">
            {formatUnitPriceDisplay(line.unitPrice)}
          </p>
          <p className="text-[10px] text-slate-500">
            {line.costBreakdown!.length} cost line
            {line.costBreakdown!.length === 1 ? "" : "s"} · edit to change
          </p>
        </td>
      ) : (
        <td className={tableGridCellClassName}>
          <QuoteUnitPriceInput
            value={line.unitPrice}
            onChange={(value) => onUpdateLine(line.id, "unitPrice", value)}
            rowIndex={rowIndex}
            onCellKeyDown={onCellKeyDown}
          />
        </td>
      )}
      <td className={tableGridCellClassName}>
        <input
          type="text"
          value={line.weight}
          data-qli-row={rowIndex}
          data-qli-col={4}
          onKeyDown={(event) => onCellKeyDown(event, rowIndex, 4)}
          onChange={(event) =>
            onUpdateLine(line.id, "weight", event.target.value)
          }
          placeholder="—"
          className={tableNumericCellInputClassName}
        />
      </td>
      <td className={tableGridCellClassName}>
        <select
          value={line.taxable ? "yes" : "no"}
          data-qli-row={rowIndex}
          data-qli-col={5}
          onKeyDown={(event) => onCellKeyDown(event, rowIndex, 5)}
          onChange={(event) =>
            onUpdateLine(line.id, "taxable", event.target.value === "yes")
          }
          className={`${tableCellInputClassName} cursor-pointer`}
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </td>
      <td className={tableComputedCellClassName}>
        {formatQuoteCurrency(getLineItemTotal(line))}
      </td>
      <td className={`${tableCellBordersClassName} px-1.5 py-1`}>
        <MoveRemoveButtons
          line={line}
          isFirst={isFirst}
          isLast={isLast}
          onRemoveLine={onRemoveLine}
          onMoveLine={onMoveLine}
          onEditCustomStructure={onEditCustomStructure}
        />
      </td>
    </tr>
  );
});

/**
 * Memoized so keystrokes in quote header fields (customer, project, notes...)
 * do not re-render every line row; rows themselves are memoized so editing one
 * line only re-renders that row. Callbacks must be referentially stable
 * (wrapped in useCallback by the parent).
 */
export const QuoteLineItemsTable = memo(function QuoteLineItemsTable({
  lineItems,
  onUpdateLine,
  onRemoveLine,
  onMoveLine,
  onMoveLineTo,
  onEditCustomStructure,
}: QuoteLineItemsTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const rowCountRef = useRef(0);
  rowCountRef.current = lineItems.length;
  const lineItemsRef = useRef(lineItems);
  lineItemsRef.current = lineItems;
  const onMoveLineToRef = useRef(onMoveLineTo);
  onMoveLineToRef.current = onMoveLineTo;

  // --- Drag-to-reorder ------------------------------------------------------
  const [dragLineId, setDragLineId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragInfoRef = useRef<{ id: string; index: number } | null>(null);

  const clearDrag = useCallback(() => {
    dragInfoRef.current = null;
    setDragLineId(null);
    setDropIndex(null);
  }, []);

  /** Insertion slot for a pointer over a row: above its top half, below its bottom half. */
  const insertionIndexFor = (
    event: DragEvent<HTMLElement>,
    rowIndex: number,
  ): number => {
    const row = (event.currentTarget as HTMLElement).closest("tr");
    if (!row) {
      return rowIndex;
    }
    const rect = row.getBoundingClientRect();
    return event.clientY - rect.top < rect.height / 2 ? rowIndex : rowIndex + 1;
  };

  const onHandleDragStart = useCallback(
    (event: DragEvent<HTMLElement>, rowIndex: number, lineId: string) => {
      dragInfoRef.current = { id: lineId, index: rowIndex };
      setDragLineId(lineId);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", lineId);
      const row = (event.currentTarget as HTMLElement).closest("tr");
      if (row) {
        event.dataTransfer.setDragImage(row, 16, row.clientHeight / 2);
      }
    },
    [],
  );

  const onRowDragOver = useCallback(
    (event: DragEvent<HTMLElement>, rowIndex: number) => {
      if (!dragInfoRef.current) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropIndex(insertionIndexFor(event, rowIndex));
    },
    [],
  );

  const onRowDrop = useCallback(
    (event: DragEvent<HTMLElement>, rowIndex: number) => {
      const drag = dragInfoRef.current;
      if (!drag) {
        return;
      }
      event.preventDefault();
      const insertAt = insertionIndexFor(event, rowIndex);
      // Removing the dragged row first shifts later slots up by one.
      const target = insertAt > drag.index ? insertAt - 1 : insertAt;
      onMoveLineToRef.current(drag.id, target);
      clearDrag();
    },
    [clearDrag],
  );

  // Referentially stable so the memoized rows don't re-render on every
  // table render (all four callbacks are themselves stable).
  const dragHandlers = useMemo<RowDragHandlers>(
    () => ({
      onHandleDragStart,
      onHandleDragEnd: clearDrag,
      onRowDragOver,
      onRowDrop,
    }),
    [onHandleDragStart, clearDrag, onRowDragOver, onRowDrop],
  );

  // Excel-style navigation: Tab/Enter walk cells left-to-right wrapping across
  // rows, arrows move by row/column, skipping cells a row doesn't expose
  // (read-only price/description on custom structures, category rows).
  // Reads only the DOM and refs so it stays referentially stable for the
  // memoized rows.
  const handleCellKeyDown = useCallback<CellKeyDownHandler>(
    (event, rowIndex, colIndex) => {
      const findCell = (row: number, col: number) =>
        tableRef.current?.querySelector<HTMLElement>(
          `[data-qli-row="${row}"][data-qli-col="${col}"]`,
        ) ?? null;

      const focusCell = (element: HTMLElement) => {
        element.focus();
        element.scrollIntoView({ block: "nearest", inline: "nearest" });
        if (element instanceof HTMLInputElement) {
          element.select();
        }
      };

      const rowCount = rowCountRef.current;
      const target = event.currentTarget;
      const isTextarea = target instanceof HTMLTextAreaElement;

      // Alt+Arrow moves the ROW itself (works from any cell, textarea too).
      if (
        event.altKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        event.preventDefault();
        const direction = event.key === "ArrowUp" ? -1 : 1;
        const line = lineItemsRef.current[rowIndex];
        if (line) {
          onMoveLineToRef.current(line.id, rowIndex + direction);
        }
        return;
      }

      // Enter keeps its newline behavior inside the description textarea.
      if (event.key === "Tab" || (event.key === "Enter" && !isTextarea)) {
        const direction = event.shiftKey ? -1 : 1;
        let row = rowIndex;
        let col = colIndex;
        for (;;) {
          col += direction;
          if (col >= NAV_COLUMN_COUNT) {
            col = 0;
            row += 1;
          } else if (col < 0) {
            col = NAV_COLUMN_COUNT - 1;
            row -= 1;
          }
          if (row < 0 || row >= rowCount) {
            return;
          }
          const element = findCell(row, col);
          if (element) {
            event.preventDefault();
            focusCell(element);
            return;
          }
        }
      }

      if (isTextarea) {
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const direction = event.key === "ArrowUp" ? -1 : 1;
        for (
          let row = rowIndex + direction;
          row >= 0 && row < rowCount;
          row += direction
        ) {
          const element = findCell(row, colIndex);
          if (element) {
            focusCell(element);
            return;
          }
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        if (target instanceof HTMLInputElement) {
          // Only leave the cell when the caret is at the edge (or the whole
          // value is selected, as it is right after arriving), so left/right
          // still move the caret while editing.
          const length = target.value.length;
          const fullySelected =
            length > 0 &&
            target.selectionStart === 0 &&
            target.selectionEnd === length;
          const atEdge =
            direction < 0
              ? target.selectionStart === 0 && target.selectionEnd === 0
              : target.selectionStart === length &&
                target.selectionEnd === length;
          if (length > 0 && !fullySelected && !atEdge) {
            return;
          }
        }
        for (
          let col = colIndex + direction;
          col >= 0 && col < NAV_COLUMN_COUNT;
          col += direction
        ) {
          const element = findCell(rowIndex, col);
          if (element) {
            event.preventDefault();
            focusCell(element);
            return;
          }
        }
      }
    },
    [],
  );

  return (
    <div className={tableWrapperClassName}>
      <table ref={tableRef} className={tableClassName}>
        <thead>
          <tr>
            <th className={`${tableHeaderCellClassName} w-6`} aria-label="Drag" />
            <th className={`${tableHeaderCellClassName} w-10 text-center`}>
              #
            </th>
            <th className={tableHeaderCellClassName}>Type</th>
            <th className={tableHeaderCellClassName}>Item</th>
            <th className={`${tableHeaderCellClassName} min-w-[18rem]`}>
              Description
            </th>
            <th className={`${tableHeaderCellClassName} w-16 text-right`}>
              Qty
            </th>
            <th className={`${tableHeaderCellClassName} w-16`}>Unit</th>
            <th className={`${tableHeaderCellClassName} w-24 text-right`}>
              Unit Price
            </th>
            <th className={`${tableHeaderCellClassName} w-20 text-right`}>
              Weight
            </th>
            <th className={`${tableHeaderCellClassName} w-16`}>Tax</th>
            <th className={`${tableHeaderCellClassName} w-24 text-right`}>
              Total
            </th>
            <th className={tableHeaderCellClassName}>Actions</th>
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {lineItems.length === 0 ? (
            <tr>
              <td
                colSpan={12}
                className={`${tableCellBordersClassName} px-3 py-6 text-center text-slate-500`}
              >
                No line items yet. Use the buttons above to add items.
              </td>
            </tr>
          ) : (
            lineItems.map((line, lineIndex) => {
              const isLast = lineIndex >= lineItems.length - 1;
              const dropEdge =
                dropIndex === lineIndex
                  ? ("top" as const)
                  : isLast && dropIndex === lineItems.length
                    ? ("bottom" as const)
                    : null;
              return (
                <QuoteLineItemRow
                  key={line.id}
                  line={line}
                  rowIndex={lineIndex}
                  rowCount={lineItems.length}
                  isFirst={lineIndex <= 0}
                  isLast={isLast}
                  isDragging={dragLineId === line.id}
                  dropEdge={dropEdge}
                  dragHandlers={dragHandlers}
                  onUpdateLine={onUpdateLine}
                  onRemoveLine={onRemoveLine}
                  onMoveLine={onMoveLine}
                  onMoveLineTo={onMoveLineTo}
                  onEditCustomStructure={onEditCustomStructure}
                  onCellKeyDown={handleCellKeyDown}
                />
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
});
