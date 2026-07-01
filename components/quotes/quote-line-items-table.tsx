"use client";

import { memo, useLayoutEffect, useRef } from "react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  type EditableQuoteLineItem,
  formatQuoteCurrency,
  getLineItemTotal,
  isCategoryLineItem,
  quoteDescriptionTextareaClassName,
} from "@/components/quotes/quote-utils";
import { RichTextContent } from "@/components/ui/rich-text-content";

const quoteTableInputClassName =
  "w-full min-w-[4rem] rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm";

const quoteCategoryInputClassName =
  "w-full min-w-[12rem] rounded border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900 underline shadow-sm";

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
}: {
  value: string;
  onChange: (value: string) => void;
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
      onChange={(event) => {
        onChange(event.target.value);
        autoResizeTextarea(event.target);
      }}
      className={quoteDescriptionTextareaClassName}
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
  isFirst: boolean;
  isLast: boolean;
  onUpdateLine: QuoteLineItemsTableProps["onUpdateLine"];
  onRemoveLine: QuoteLineItemsTableProps["onRemoveLine"];
  onMoveLine: QuoteLineItemsTableProps["onMoveLine"];
  onEditCustomStructure: QuoteLineItemsTableProps["onEditCustomStructure"];
};

function MoveRemoveButtons({
  line,
  isFirst,
  isLast,
  onRemoveLine,
  onMoveLine,
  onEditCustomStructure,
}: Omit<QuoteLineItemRowProps, "onUpdateLine">) {
  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        onClick={() => onMoveLine(line.id, "up")}
        disabled={isFirst}
        className="inline-flex rounded-md border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Move line ${line.lineNumber} up`}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onMoveLine(line.id, "down")}
        disabled={isLast}
        className="inline-flex rounded-md border border-slate-200 px-1.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Move line ${line.lineNumber} down`}
      >
        ↓
      </button>
      {line.type === "CUSTOM_STRUCTURE" ? (
        <button
          type="button"
          onClick={() => onEditCustomStructure(line)}
          className="inline-flex rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
        >
          Edit
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onRemoveLine(line.id)}
        className="inline-flex rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
      >
        Remove
      </button>
    </div>
  );
}

const QuoteLineItemRow = memo(function QuoteLineItemRow({
  line,
  isFirst,
  isLast,
  onUpdateLine,
  onRemoveLine,
  onMoveLine,
  onEditCustomStructure,
}: QuoteLineItemRowProps) {
  if (isCategoryLineItem(line.type)) {
    return (
      <tr className="align-top bg-slate-50/40 hover:bg-slate-50/80">
        <td className="whitespace-nowrap px-3 py-2 text-slate-700">
          {line.lineNumber}
        </td>
        <td className="px-3 py-2">
          <StatusBadge label={line.typeLabel} variant="neutral" />
        </td>
        <td className="px-3 py-2 text-slate-400">—</td>
        <td className="min-w-[18rem] px-3 py-2" colSpan={1}>
          <input
            type="text"
            value={line.description}
            onChange={(event) =>
              onUpdateLine(line.id, "description", event.target.value)
            }
            placeholder="Category name"
            className={quoteCategoryInputClassName}
          />
        </td>
        <td className="px-3 py-2 text-slate-400">—</td>
        <td className="px-3 py-2 text-slate-400">—</td>
        <td className="px-3 py-2 text-slate-400">—</td>
        <td className="px-3 py-2 text-slate-400">—</td>
        <td className="px-3 py-2 text-slate-400">—</td>
        <td className="px-3 py-2 text-slate-400">—</td>
        <td className="px-3 py-2 text-slate-400">—</td>
        <td className="px-3 py-2">
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
    <tr className="align-top hover:bg-slate-50/60">
      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
        {line.lineNumber}
      </td>
      <td className="px-3 py-2">
        <StatusBadge label={line.typeLabel} variant="neutral" />
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">
        {line.item}
      </td>
      <td className="min-w-[18rem] px-3 py-2">
        {line.type === "CUSTOM_STRUCTURE" ? (
          <RichTextContent
            value={line.description}
            className="text-sm leading-snug text-slate-600"
          />
        ) : (
          <QuoteLineDescriptionTextarea
            value={line.description}
            onChange={(value) => onUpdateLine(line.id, "description", value)}
          />
        )}
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={line.qty}
          onChange={(event) =>
            onUpdateLine(line.id, "qty", event.target.value)
          }
          className={`${quoteTableInputClassName} w-16 min-w-0`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={line.unit}
          onChange={(event) =>
            onUpdateLine(line.id, "unit", event.target.value)
          }
          className={`${quoteTableInputClassName} w-16 min-w-0`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={line.unitPrice}
          onChange={(event) =>
            onUpdateLine(line.id, "unitPrice", event.target.value)
          }
          className={`${quoteTableInputClassName} w-24 min-w-0`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={line.weight}
          onChange={(event) =>
            onUpdateLine(line.id, "weight", event.target.value)
          }
          placeholder="—"
          className={`${quoteTableInputClassName} w-20 min-w-0`}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={line.yards}
          onChange={(event) =>
            onUpdateLine(line.id, "yards", event.target.value)
          }
          placeholder="—"
          className={`${quoteTableInputClassName} w-16 min-w-0`}
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={line.taxable ? "yes" : "no"}
          onChange={(event) =>
            onUpdateLine(line.id, "taxable", event.target.value === "yes")
          }
          className={`${quoteTableInputClassName} w-16 min-w-0`}
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">
        {formatQuoteCurrency(getLineItemTotal(line))}
      </td>
      <td className="px-3 py-2">
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
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table className="min-w-full table-auto text-left text-xs">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
            <th className="w-10 whitespace-nowrap px-3 py-2 font-semibold">
              #
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">
              Type
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">
              Item
            </th>
            <th className="min-w-[18rem] px-3 py-2 font-semibold">
              Description
            </th>
            <th className="w-16 whitespace-nowrap px-3 py-2 font-semibold">
              Qty
            </th>
            <th className="w-16 whitespace-nowrap px-3 py-2 font-semibold">
              Unit
            </th>
            <th className="w-24 whitespace-nowrap px-3 py-2 font-semibold">
              Unit Price
            </th>
            <th className="w-20 whitespace-nowrap px-3 py-2 font-semibold">
              Weight
            </th>
            <th className="w-16 whitespace-nowrap px-3 py-2 font-semibold">
              Yards
            </th>
            <th className="w-16 whitespace-nowrap px-3 py-2 font-semibold">
              Tax
            </th>
            <th className="w-24 whitespace-nowrap px-3 py-2 font-semibold">
              Total
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lineItems.length === 0 ? (
            <tr>
              <td
                colSpan={12}
                className="px-3 py-6 text-center text-slate-500"
              >
                No line items yet. Use the buttons above to add items.
              </td>
            </tr>
          ) : (
            lineItems.map((line, lineIndex) => (
              <QuoteLineItemRow
                key={line.id}
                line={line}
                isFirst={lineIndex <= 0}
                isLast={lineIndex >= lineItems.length - 1}
                onUpdateLine={onUpdateLine}
                onRemoveLine={onRemoveLine}
                onMoveLine={onMoveLine}
                onEditCustomStructure={onEditCustomStructure}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});
