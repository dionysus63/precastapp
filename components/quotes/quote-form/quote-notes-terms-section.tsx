"use client";

import type { ReactNode } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  formatQuoteCurrency,
  quoteCompactInputClassName,
  quoteInputClassName,
} from "@/components/quotes/quote-utils";
import type { ShippingHint } from "@/components/quotes/quote-form/quote-form-utils";

/**
 * "Notes and Terms" card. The delivery pricing panel is passed in as a slot
 * so it renders between the notes and the F.O.B./terms row.
 */
export function QuoteNotesTermsSection({
  internalNotes,
  onInternalNotesChange,
  customerNotes,
  onCustomerNotesChange,
  deliveryPricing,
  fob,
  onFobChange,
  termsAndConditions,
  onTermsAndConditionsChange,
  paymentTermOptions,
  leadTime,
  onLeadTimeChange,
  deliveryNotes,
  onDeliveryNotesChange,
}: {
  internalNotes: string;
  onInternalNotesChange: (value: string) => void;
  customerNotes: string;
  onCustomerNotesChange: (value: string) => void;
  deliveryPricing: ReactNode;
  fob: string;
  onFobChange: (value: string) => void;
  termsAndConditions: string;
  onTermsAndConditionsChange: (value: string) => void;
  paymentTermOptions: string[];
  leadTime: string;
  onLeadTimeChange: (value: string) => void;
  deliveryNotes: string;
  onDeliveryNotesChange: (value: string) => void;
}) {
  return (
    <SectionCard title="Notes and Terms">
      <div className="grid gap-5">
        <div>
          <label
            htmlFor="internalNotes"
            className="block text-xs font-medium text-slate-700"
          >
            Internal Notes
          </label>
          <textarea
            id="internalNotes"
            name="internalNotes"
            rows={3}
            value={internalNotes}
            onChange={(event) => onInternalNotesChange(event.target.value)}
            className={quoteInputClassName}
          />
        </div>
        <div>
          <label
            htmlFor="customerNotes"
            className="block text-xs font-medium text-slate-700"
          >
            Customer-Facing Notes
          </label>
          <textarea
            id="customerNotes"
            name="customerNotes"
            rows={3}
            value={customerNotes}
            onChange={(event) => onCustomerNotesChange(event.target.value)}
            className={quoteInputClassName}
          />
        </div>
        {deliveryPricing}

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label
              htmlFor="fob"
              className="block text-xs font-medium text-slate-700"
            >
              F.O.B.
            </label>
            <input
              id="fob"
              name="fob"
              type="text"
              value={fob}
              onChange={(event) => onFobChange(event.target.value)}
              placeholder="Factory"
              className={quoteInputClassName}
            />
          </div>
          <div>
            <label
              htmlFor="terms"
              className="block text-xs font-medium text-slate-700"
            >
              Terms and Conditions
            </label>
            <select
              id="terms"
              name="terms"
              value={termsAndConditions}
              onChange={(event) =>
                onTermsAndConditionsChange(event.target.value)
              }
              className={quoteInputClassName}
            >
              <option value="">Select terms…</option>
              {paymentTermOptions.map((terms) => (
                <option key={terms} value={terms}>
                  {terms}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="leadTime"
              className="block text-xs font-medium text-slate-700"
            >
              Lead Time
            </label>
            <input
              id="leadTime"
              name="leadTime"
              type="text"
              value={leadTime}
              onChange={(event) => onLeadTimeChange(event.target.value)}
              placeholder="4–6 weeks ARO"
              className={quoteInputClassName}
            />
          </div>
          <div>
            <label
              htmlFor="deliveryNotes"
              className="block text-xs font-medium text-slate-700"
            >
              Delivery Notes
            </label>
            <input
              id="deliveryNotes"
              name="deliveryNotes"
              type="text"
              value={deliveryNotes}
              onChange={(event) => onDeliveryNotesChange(event.target.value)}
              placeholder="Site delivery, crane required"
              className={quoteInputClassName}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/** Loads × price-per-load calculator with the "add/update delivery line" action. */
export function QuoteDeliveryPricingPanel({
  shippingHint,
  deliveryLoadsInput,
  onDeliveryLoadsInputChange,
  autoDeliveryLoads,
  maxLoadLbsInput,
  onMaxLoadLbsInputChange,
  pricePerLoadInput,
  onPricePerLoadInputChange,
  deliveryTotal,
  hasDeliveryLine,
  onApplyDeliveryLine,
}: {
  shippingHint: ShippingHint | null;
  deliveryLoadsInput: string;
  onDeliveryLoadsInputChange: (value: string) => void;
  autoDeliveryLoads: number | null;
  maxLoadLbsInput: string;
  onMaxLoadLbsInputChange: (value: string) => void;
  pricePerLoadInput: string;
  onPricePerLoadInputChange: (value: string) => void;
  deliveryTotal: number | null;
  /** Whether the delivery line was already added (button says "Update"). */
  hasDeliveryLine: boolean;
  onApplyDeliveryLine: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">
          Delivery Pricing
        </p>
        {shippingHint ? (
          <p className="text-[11px] font-medium text-slate-600">
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
              style={{ backgroundColor: shippingHint.color }}
            />
            {shippingHint.zoneName}
            {shippingHint.distanceMiles !== null
              ? ` — ${shippingHint.distanceMiles.toFixed(0)} mi from yard`
              : ""}
          </p>
        ) : (
          <p className="text-[11px] text-slate-400">
            No zone matched — enter a project address in Quote
            Details or price manually
          </p>
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div>
          <label
            htmlFor="deliveryLoads"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Loads
          </label>
          <input
            id="deliveryLoads"
            type="number"
            min="0"
            step="1"
            value={deliveryLoadsInput}
            onChange={(event) =>
              onDeliveryLoadsInputChange(event.target.value)
            }
            placeholder={
              autoDeliveryLoads !== null
                ? String(autoDeliveryLoads)
                : "—"
            }
            className={quoteCompactInputClassName}
          />
          <p className="mt-0.5 text-[10px] text-slate-400">
            {deliveryLoadsInput.trim()
              ? autoDeliveryLoads !== null
                ? `auto would be ${autoDeliveryLoads}`
                : "manual"
              : "blank = auto from weight"}
          </p>
        </div>
        <div>
          <label
            htmlFor="maxLoadLbs"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Max Weight / Load (lb)
          </label>
          <input
            id="maxLoadLbs"
            type="text"
            inputMode="numeric"
            value={maxLoadLbsInput}
            onChange={(event) => onMaxLoadLbsInputChange(event.target.value)}
            placeholder="80,000"
            className={quoteCompactInputClassName}
          />
        </div>
        <div>
          <label
            htmlFor="pricePerLoad"
            className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
          >
            Price / Load ($)
          </label>
          <input
            id="pricePerLoad"
            type="number"
            min="0"
            step="0.01"
            value={pricePerLoadInput}
            onChange={(event) =>
              onPricePerLoadInputChange(event.target.value)
            }
            className={quoteCompactInputClassName}
          />
        </div>
        <div>
          <p className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Delivery Total
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {deliveryTotal !== null
              ? formatQuoteCurrency(deliveryTotal)
              : "—"}
          </p>
          <button
            type="button"
            onClick={onApplyDeliveryLine}
            disabled={deliveryTotal === null}
            className="mt-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {hasDeliveryLine
              ? "Update delivery line"
              : "Add as line item"}
          </button>
        </div>
      </div>
    </div>
  );
}
