"use client";

import Link from "next/link";
import {
  searchCustomersForQuoteForm,
  type QuoteSaveDestination,
} from "@/app/quotes/actions";
import { QuoteFormTypeahead } from "@/components/quotes/quote-form-typeahead";
import {
  type QuoteFormCustomerOption,
  type calculateQuoteTotals,
  formatQuoteCurrency,
  formatQuoteWeight,
  formatQuoteYards,
  quoteCompactInputClassName,
} from "@/components/quotes/quote-utils";

/**
 * Sticky strip at the top of the quote form: customer / project / scope /
 * job number, running totals, and the save / preview / send actions.
 */
export function QuoteFormStickyHeader({
  customerId,
  customerName,
  selectedCustomer,
  onCustomerSelect,
  onCustomerNameChange,
  projectName,
  onProjectNameChange,
  scopeLabel,
  onScopeLabelChange,
  jobNumber,
  onJobNumberChange,
  totals,
  isPending,
  isEditing,
  quoteId,
  onSaveDraft,
  onSaveAndPreview,
}: {
  customerId: string;
  customerName: string;
  selectedCustomer: QuoteFormCustomerOption | null;
  onCustomerSelect: (customer: QuoteFormCustomerOption | null) => void;
  onCustomerNameChange: (value: string) => void;
  projectName: string;
  onProjectNameChange: (value: string) => void;
  scopeLabel: string;
  onScopeLabelChange: (value: string) => void;
  jobNumber: string;
  onJobNumberChange: (value: string) => void;
  totals: ReturnType<typeof calculateQuoteTotals>;
  isPending: boolean;
  isEditing: boolean;
  quoteId: string | undefined;
  onSaveDraft: (afterSave?: QuoteSaveDestination) => void;
  onSaveAndPreview: () => void;
}) {
  return (
    <div className="sticky top-[4.5rem] z-[9] -mx-5 mb-4 border-b border-slate-200/80 bg-white/95 px-5 py-2 shadow-sm backdrop-blur">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_7rem]">
        <div>
          <label
            htmlFor="sticky-customer"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Customer
          </label>
          <div className="space-y-1">
            <QuoteFormTypeahead
              inputId="sticky-customer"
              selectedLabel={customerId ? customerName : ""}
              placeholder="Search customers"
              initialItems={selectedCustomer ? [selectedCustomer] : []}
              searchItems={searchCustomersForQuoteForm}
              itemKey={(customer) => customer.id}
              itemLabel={(customer) => customer.name}
              onSelect={onCustomerSelect}
              clearLabel="No linked customer"
              emptyLabel="No customers match."
              inputClassName={quoteCompactInputClassName}
            />
            {!customerId ? (
              <input
                type="text"
                value={customerName}
                onChange={(event) => onCustomerNameChange(event.target.value)}
                placeholder="Or type customer name"
                className={quoteCompactInputClassName}
              />
            ) : null}
          </div>
        </div>
        <div>
          <label
            htmlFor="sticky-projectName"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Project Name
          </label>
          <input
            id="sticky-projectName"
            name="projectName"
            type="text"
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
            placeholder="Main Street Drainage"
            className={quoteCompactInputClassName}
          />
        </div>
        <div>
          <label
            htmlFor="sticky-scopeLabel"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Scope / Area
          </label>
          <input
            id="sticky-scopeLabel"
            name="scopeLabel"
            type="text"
            value={scopeLabel}
            onChange={(event) => onScopeLabelChange(event.target.value)}
            placeholder="Area A — Structural"
            className={quoteCompactInputClassName}
          />
        </div>
        <div>
          <label
            htmlFor="sticky-jobNumber"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Job Number
          </label>
          <input
            id="sticky-jobNumber"
            name="jobNumber"
            type="text"
            value={jobNumber}
            onChange={(event) => onJobNumberChange(event.target.value)}
            placeholder="26-001"
            className={quoteCompactInputClassName}
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 pt-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-slate-500">
            Subtotal{" "}
            <span className="font-medium text-slate-700">
              {formatQuoteCurrency(totals.subtotal)}
            </span>
          </span>
          <span className="text-slate-500">
            Tax{" "}
            <span className="font-medium text-slate-700">
              {formatQuoteCurrency(totals.salesTax)}
            </span>
          </span>
          <span className="text-slate-700">
            Total{" "}
            <span className="text-sm font-semibold text-slate-900">
              {formatQuoteCurrency(totals.total)}
            </span>
          </span>
          <span className="text-slate-500">
            Weight{" "}
            <span className="font-medium text-slate-700">
              {formatQuoteWeight(totals.totalWeight)}
            </span>
          </span>
          <span className="text-slate-500">
            Yards{" "}
            <span className="font-medium text-slate-700">
              {formatQuoteYards(totals.totalYards)}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSaveDraft()}
            disabled={isPending}
            className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={onSaveAndPreview}
            disabled={isPending}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Preview PDF"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onSaveDraft("send")}
            title="Save the quote, then open the send dialog"
            className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Send Quote"}
          </button>
          <Link
            href={isEditing ? `/quotes/${quoteId}` : "/quotes"}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
