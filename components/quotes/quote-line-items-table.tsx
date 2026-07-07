"use client";

import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
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
// Description=0, Qty=1, Unit=2, Unit Price=3, Weight=4, Yards=5, Tax=6.
// Rows expose only the columns that are editable for them (category rows only
// col 0; custom structures skip cols 0 and 3), so navigation skips the gaps.
const NAV_COLUMN_COUNT = 7;

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

export type QuoteLineItemsTableProps = {
  lineItems: EditableQuoteLineItem[];
  onUpdateLine: (
    id: string,
    field: keyof EditableQuoteLineItem,
    value: string | boolean,
  ) => void;
  onRemoveLine: (id: string) => void;
  onMoveLine: (id: string, direction: "up" | "down") => void;
  onEditCustomStructure: (line: EditableQuoteLineItem) => void;
};

type QuoteLineItemRowProps = {
  line: EditableQuoteLineItem;
  rowIndex: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdateLine: QuoteLineItemsTableProps["onUpdateLine"];
  onRemoveLine: QuoteLineItemsTableProps["onRemoveLine"];
  onMoveLine: QuoteLineItemsTableProps["onMoveLine"];
  onEditCustomStructure: QuoteLineItemsTableProps["onEditCustomStructure"];
  onCellKeyDown: CellKeyDownHandler;
};

function MoveRemoveButtons({
  line,
  isFirst,
  isLast,
  onRemoveLine,
  onMoveLine,
  onEditCustomStructure,
}: Omit<QuoteLineItemRowProps, "onUpdateLine" | "onCellKeyDown" | "rowIndex">) {
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
  isFirst,
  isLast,
  onUpdateLine,
  onRemoveLine,
  onMoveLine,
  onEditCustomStructure,
  onCellKeyDown,
}: QuoteLineItemRowProps) {
  if (isCategoryLineItem(line.type)) {
    return (
      <tr className={tableRowClassName}>
        <td className={tableRowNumberCellClassName}>{line.lineNumber}</td>
        <td className={tableCellClassName}>
          <StatusBadge label={line.typeLabel} variant="neutral" />
        </td>
        <td className={`${tableGridCellClassName} bg-slate-50/60`} colSpan={9}>
          <QuoteLineDescriptionTextarea
            value={line.description}
            onChange={(value) => onUpdateLine(line.id, "description", value)}
            className={`${tableCellTextareaClassName} font-medium`}
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
    <tr className={tableRowClassName}>
      <td className={tableRowNumberCellClassName}>{line.lineNumber}</td>
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
          <p className="font-medium tabular-nums text-slate-900">
            {line.unitPrice}
          </p>
          <p className="text-[10px] text-slate-500">
            {line.costBreakdown!.length} cost line
            {line.costBreakdown!.length === 1 ? "" : "s"} · edit to change
          </p>
        </td>
      ) : (
        <td className={tableGridCellClassName}>
          <input
            type="text"
            value={line.unitPrice}
            data-qli-row={rowIndex}
            data-qli-col={3}
            onKeyDown={(event) => onCellKeyDown(event, rowIndex, 3)}
            onChange={(event) =>
              onUpdateLine(line.id, "unitPrice", event.target.value)
            }
            className={tableNumericCellInputClassName}
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
        <input
          type="text"
          value={line.yards}
          data-qli-row={rowIndex}
          data-qli-col={5}
          onKeyDown={(event) => onCellKeyDown(event, rowIndex, 5)}
          onChange={(event) =>
            onUpdateLine(line.id, "yards", event.target.value)
          }
          placeholder="—"
          className={tableNumericCellInputClassName}
        />
      </td>
      <td className={tableGridCellClassName}>
        <select
          value={line.taxable ? "yes" : "no"}
          data-qli-row={rowIndex}
          data-qli-col={6}
          onKeyDown={(event) => onCellKeyDown(event, rowIndex, 6)}
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
  onEditCustomStructure,
}: QuoteLineItemsTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const rowCountRef = useRef(0);
  rowCountRef.current = lineItems.length;

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
            <th className={`${tableHeaderCellClassName} w-16 text-right`}>
              Yards
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
            lineItems.map((line, lineIndex) => (
              <QuoteLineItemRow
                key={line.id}
                line={line}
                rowIndex={lineIndex}
                isFirst={lineIndex <= 0}
                isLast={lineIndex >= lineItems.length - 1}
                onUpdateLine={onUpdateLine}
                onRemoveLine={onRemoveLine}
                onMoveLine={onMoveLine}
                onEditCustomStructure={onEditCustomStructure}
                onCellKeyDown={handleCellKeyDown}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});
