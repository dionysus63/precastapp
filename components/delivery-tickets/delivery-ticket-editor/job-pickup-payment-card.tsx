"use client";

import type { Dispatch, SetStateAction } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { inputClass } from "./editor-styles";
import type { PaymentMethodValue } from "./types";

type JobPickupPaymentCardProps = {
  paymentMethod: PaymentMethodValue;
  setPaymentMethod: Dispatch<SetStateAction<PaymentMethodValue>>;
  pickedUpBy: string;
  setPickedUpBy: Dispatch<SetStateAction<string>>;
  paymentReceived: boolean;
  setPaymentReceived: Dispatch<SetStateAction<boolean>>;
};

/** JOB ticket on customer pickup: payment method, picked-up-by, paid flag. */
export function JobPickupPaymentCard({
  paymentMethod,
  setPaymentMethod,
  pickedUpBy,
  setPickedUpBy,
  paymentReceived,
  setPaymentReceived,
}: JobPickupPaymentCardProps) {
  return (
    <SectionCard
      title="Pickup & payment"
      description="How the customer is paying and who is picking up."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Payment method
          </label>
          <select
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(
                event.target.value as "PAY_NOW" | "ON_ACCOUNT" | "",
              )
            }
            className={inputClass}
          >
            <option value="">Not specified</option>
            <option value="PAY_NOW">Pay now</option>
            <option value="ON_ACCOUNT">Charge to account</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Picked up by (optional)
          </label>
          <input
            value={pickedUpBy}
            onChange={(event) => setPickedUpBy(event.target.value)}
            placeholder="Name on pickup"
            className={inputClass}
          />
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={paymentReceived}
          onChange={(event) => setPaymentReceived(event.target.checked)}
        />
        Payment received
      </label>
    </SectionCard>
  );
}
