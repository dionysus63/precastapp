"use client";

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
} & QuoteLineItemsTableProps) {
  return (
    <SectionCard
      title="Quote Line Items"
      description="Add stock products, structures, and services to the quote."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {quoteLineItemTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onOpenAddModal(option.value as AddLineModalType)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                activeLineType === option.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onOpenRingBuilder()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Add Rings
          </button>
          <button
            type="button"
            onClick={() => onOpenPipeModal("ADS_PIPE")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Add ADS Pipe
          </button>
          <button
            type="button"
            onClick={() => onOpenPipeModal("PRECAST_PIPE")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Add RCP Pipe
          </button>
          <button
            type="button"
            onClick={onOpenStructureWorkbook}
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-800 transition-colors hover:bg-sky-100"
          >
            Circular Structure Workbook
          </button>
          <button
            type="button"
            onClick={onOpenRectStructureWorkbook}
            className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-[11px] font-semibold text-teal-800 transition-colors hover:bg-teal-100"
          >
            Rectangular Structure Workbook
          </button>
          <button
            type="button"
            onClick={onAddCategoryLine}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Add Category
          </button>
          <button
            type="button"
            onClick={onAddNoteLine}
            title="A text-only row on the printed quote — no quantity or price."
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Add Note
          </button>
          <button
            type="button"
            onClick={onAddPageBreakLine}
            title="Everything after this line starts on a new page of the printed quote."
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Add Page Break
          </button>
        </div>

        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {activeHint}
        </p>

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
