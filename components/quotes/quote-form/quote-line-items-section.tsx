"use client";

import type { ReactNode } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  QuoteLineItemsTable,
  type QuoteLineItemsTableProps,
} from "@/components/quotes/quote-line-items-table";
import {
  type QuoteLineItemType,
  quoteLineItemTypeOptions,
} from "@/components/quotes/quote-utils";
import type { PipeQuoteProductType } from "@/lib/pipe-quote-utils";
import type { AddLineModalType } from "@/components/quotes/quote-form/quote-form-utils";
import { selectedClassName } from "@/lib/selected-styles";

/** "Quote Line Items" card: the add-line buttons, type hint and the table. */
export function QuoteLineItemsSection({
  activeLineType,
  activeHint,
  onOpenAddModal,
  onOpenRingBuilder,
  onOpenPipeModal,
  onOpenStructureWorkbook,
  onOpenRectStructureWorkbook,
  onAddCategoryLine,
  onAddNoteLine,
  onAddPageBreakLine,
  discountBar,
  lineItems,
  onUpdateLine,
  onRemoveLine,
  onMoveLine,
  onMoveLineTo,
  onEditCustomStructure,
}: {
  activeLineType: QuoteLineItemType;
  activeHint: string;
  onOpenAddModal: (type: AddLineModalType) => void;
  onOpenRingBuilder: () => void;
  onOpenPipeModal: (type: PipeQuoteProductType) => void;
  onOpenStructureWorkbook: () => void;
  onOpenRectStructureWorkbook: () => void;
  onAddCategoryLine: () => void;
  onAddNoteLine: () => void;
  onAddPageBreakLine: () => void;
  /** Delivered or picked up, and whether the quote prints the discount. */
  discountBar?: ReactNode;
} & QuoteLineItemsTableProps) {
  return (
    <SectionCard
      title="Quote Line Items"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {quoteLineItemTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onOpenAddModal(option.value as AddLineModalType)}
              className={`rounded-lg border px-3 py-1.5 text-2xs font-semibold transition-colors ${
                activeLineType === option.value
                  ? selectedClassName
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onOpenRingBuilder()}
            className="rounded-lg btn-plain px-3 py-1.5 text-2xs font-semibold transition-colors"
          >
            Add Rings
          </button>
          <button
            type="button"
            onClick={() => onOpenPipeModal("ADS_PIPE")}
            className="rounded-lg btn-plain px-3 py-1.5 text-2xs font-semibold transition-colors"
          >
            Add ADS Pipe
          </button>
          <button
            type="button"
            onClick={() => onOpenPipeModal("PRECAST_PIPE")}
            className="rounded-lg btn-plain px-3 py-1.5 text-2xs font-semibold transition-colors"
          >
            Add RCP Pipe
          </button>
          <button
            type="button"
            onClick={onOpenStructureWorkbook}
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-2xs font-semibold text-sky-800 transition-colors hover:bg-sky-100"
          >
            Circular Structure Workbook
          </button>
          <button
            type="button"
            onClick={onOpenRectStructureWorkbook}
            className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-2xs font-semibold text-teal-800 transition-colors hover:bg-teal-100"
          >
            Rectangular Structure Workbook
          </button>
          <button
            type="button"
            onClick={onAddCategoryLine}
            className="rounded-lg btn-plain px-3 py-1.5 text-2xs font-semibold transition-colors"
          >
            Add Category
          </button>
          <button
            type="button"
            onClick={onAddNoteLine}
            title="A text-only row on the printed quote — no quantity or price."
            className="rounded-lg btn-plain px-3 py-1.5 text-2xs font-semibold transition-colors"
          >
            Add Note
          </button>
          <button
            type="button"
            onClick={onAddPageBreakLine}
            title="Everything after this line starts on a new page of the printed quote."
            className="rounded-lg btn-plain px-3 py-1.5 text-2xs font-semibold transition-colors"
          >
            Add Page Break
          </button>
        </div>

        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {activeHint}
        </p>

        {discountBar}

        <QuoteLineItemsTable
          lineItems={lineItems}
          onUpdateLine={onUpdateLine}
          onRemoveLine={onRemoveLine}
          onMoveLine={onMoveLine}
          onMoveLineTo={onMoveLineTo}
          onEditCustomStructure={onEditCustomStructure}
        />
      </div>
    </SectionCard>
  );
}
