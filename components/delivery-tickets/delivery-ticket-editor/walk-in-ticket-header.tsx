"use client";

import type { Dispatch, ReactNode, Ref, SetStateAction } from "react";
import { searchCustomersForWalkInTicket } from "@/app/delivery-tickets/actions";
import { FormTypeahead } from "@/components/common/form-typeahead";
import { formatUsd } from "@/lib/format";
import { compactInputClass, compactLabelClass } from "./editor-styles";
import { formatWeight } from "./editor-utils";
import type { PaymentMethodValue } from "./types";

type WalkInTicketHeaderProps = {
  stickyRef: Ref<HTMLDivElement>;
  ticketTypeButtons: ReactNode;
  actionButtons: ReactNode;
  walkInPieceCount: number;
  walkInSubtotal: number;
  walkInMissingPriceCount: number;
  totalWeight: number;
  walkInOneOff: boolean;
  setWalkInOneOff: Dispatch<SetStateAction<boolean>>;
  walkInCustomer: string;
  setWalkInCustomer: Dispatch<SetStateAction<string>>;
  walkInCustomerId: string | null;
  setWalkInCustomerId: Dispatch<SetStateAction<string | null>>;
  walkInReference: string;
  setWalkInReference: Dispatch<SetStateAction<string>>;
  deliveryDate: string;
  setDeliveryDate: Dispatch<SetStateAction<string>>;
  paymentMethod: PaymentMethodValue;
  setPaymentMethod: Dispatch<SetStateAction<PaymentMethodValue>>;
  pickedUpBy: string;
  setPickedUpBy: Dispatch<SetStateAction<string>>;
  paymentReceived: boolean;
  setPaymentReceived: Dispatch<SetStateAction<boolean>>;
  priceListOptions: { id: string; name: string; isDefault: boolean }[];
  priceListId: string | null;
  priceListLoading: boolean;
  onPriceListChange: (nextId: string) => void;
  markDirty: () => void;
};

/** Sticky walk-in bar: totals, actions, customer / reference / pickup date /
 * payment fields and the price-list switcher. */
export function WalkInTicketHeader({
  stickyRef,
  ticketTypeButtons,
  actionButtons,
  walkInPieceCount,
  walkInSubtotal,
  walkInMissingPriceCount,
  totalWeight,
  walkInOneOff,
  setWalkInOneOff,
  walkInCustomer,
  setWalkInCustomer,
  walkInCustomerId,
  setWalkInCustomerId,
  walkInReference,
  setWalkInReference,
  deliveryDate,
  setDeliveryDate,
  paymentMethod,
  setPaymentMethod,
  pickedUpBy,
  setPickedUpBy,
  paymentReceived,
  setPaymentReceived,
  priceListOptions,
  priceListId,
  priceListLoading,
  onPriceListChange,
  markDirty,
}: WalkInTicketHeaderProps) {
  return (
    <div
      ref={stickyRef}
      className="sticky top-[74px] z-[9] rounded-xl border border-slate-300 bg-white/95 shadow-lg shadow-slate-900/5 backdrop-blur"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-3">
          {ticketTypeButtons}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="rounded-full bg-slate-900 px-2 py-0.5 font-semibold text-white">
              {walkInPieceCount} {walkInPieceCount === 1 ? "item" : "items"}
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {formatUsd(walkInSubtotal)}
            </span>
            {walkInMissingPriceCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                {walkInMissingPriceCount} without a price
              </span>
            ) : null}
            {totalWeight > 0 ? <span>{formatWeight(totalWeight)}</span> : null}
          </div>
        </div>
        {actionButtons}
      </div>

      <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5 px-3 py-1.5">
        <div className="w-56 max-w-full min-w-0 shrink-0">
          <span className="mb-1 flex items-baseline justify-between">
            <label htmlFor="walkInCustomer" className={`${compactLabelClass} mb-0`}>
              Customer
            </label>
            <button
              type="button"
              onClick={() => {
                setWalkInOneOff((current) => !current);
                setWalkInCustomerId(null);
                setWalkInCustomer("");
              }}
              className="text-[10px] font-medium text-slate-400 underline-offset-2 hover:text-slate-900 hover:underline"
            >
              {walkInOneOff ? "search customers" : "cash sale"}
            </button>
          </span>
          {walkInOneOff ? (
            <input
              id="walkInCustomer"
              value={walkInCustomer}
              onChange={(event) => setWalkInCustomer(event.target.value)}
              placeholder="Cash sale / customer name"
              className={compactInputClass}
            />
          ) : (
            <FormTypeahead
              inputId="walkInCustomer"
              selectedLabel={walkInCustomerId ? walkInCustomer : ""}
              placeholder="Search customers…"
              searchItems={searchCustomersForWalkInTicket}
              itemKey={(customer) => customer.id}
              itemLabel={(customer) => customer.name}
              clearLabel="Clear customer"
              onSelect={(customer) => {
                setWalkInCustomerId(customer?.id ?? null);
                setWalkInCustomer(customer?.name ?? "");
                markDirty();
              }}
              inputClassName={`${compactInputClass} min-w-0`}
            />
          )}
        </div>
        <div className="w-40 max-w-full shrink-0">
          <label htmlFor="walkInReference" className={compactLabelClass}>
            Reference / PO
          </label>
          <input
            id="walkInReference"
            value={walkInReference}
            onChange={(event) => setWalkInReference(event.target.value)}
            placeholder="Walk-in sale"
            className={compactInputClass}
          />
        </div>
        <div className="w-36 max-w-full shrink-0">
          <label htmlFor="deliveryDate" className={compactLabelClass}>
            Pickup date
          </label>
          <input
            id="deliveryDate"
            type="date"
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
            className={compactInputClass}
          />
        </div>
        <div className="w-40 max-w-full shrink-0">
          <label htmlFor="walkInPayment" className={compactLabelClass}>
            Payment
          </label>
          <select
            id="walkInPayment"
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(
                event.target.value as "PAY_NOW" | "ON_ACCOUNT" | "",
              )
            }
            className={compactInputClass}
          >
            <option value="">Not specified</option>
            <option value="PAY_NOW">Pay now</option>
            <option value="ON_ACCOUNT">Charge to account</option>
          </select>
        </div>
        <div className="w-40 max-w-full shrink-0">
          <label htmlFor="walkInPickedUpBy" className={compactLabelClass}>
            Picked up by
          </label>
          <input
            id="walkInPickedUpBy"
            value={pickedUpBy}
            onChange={(event) => setPickedUpBy(event.target.value)}
            placeholder="Name on pickup"
            className={compactInputClass}
          />
        </div>
        <label className="flex h-8 items-center gap-1.5 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={paymentReceived}
            onChange={(event) => setPaymentReceived(event.target.checked)}
          />
          Paid
        </label>
        {priceListOptions.length > 0 ? (
          <div className="ml-auto max-w-full shrink-0">
            <label htmlFor="walkInPriceList" className={compactLabelClass}>
              Price list
            </label>
            <div className="flex items-center gap-1.5">
              <div className="w-44">
                <select
                  id="walkInPriceList"
                  value={priceListId ?? ""}
                  disabled={priceListLoading}
                  onChange={(event) =>
                    onPriceListChange(event.target.value)
                  }
                  className={compactInputClass}
                >
                  {priceListOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                      {option.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                {priceListLoading ? "Loading…" : "Pickup prices"}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
