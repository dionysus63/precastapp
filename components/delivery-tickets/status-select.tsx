"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DeliveryTicketStatus } from "@/app/generated/prisma/client";
import { updateDeliveryTicketStatus } from "@/app/delivery-tickets/actions";
import {
  deliveryTicketStatusFlow,
  deliveryTicketStatusLabels,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import { deliveryTicketStatusVariant } from "@/lib/status-variants";
import { StatusBadge } from "@/components/dashboard/status-badge";

// Same palette as StatusBadge so the dropdown still reads as a status color.
const VARIANT_SELECT_STYLES: Record<
  ReturnType<typeof deliveryTicketStatusVariant>,
  string
> = {
  default: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border-zinc-200 bg-zinc-100 text-zinc-600",
};

type StatusSelectProps = {
  ticketId: string;
  status: DeliveryTicketStatus;
};

// Delivered deducts inventory and cancelled has no way back from this
// dropdown, so both get a confirm before the action fires.
const CONFIRM_MESSAGES: Partial<Record<DeliveryTicketStatus, string>> = {
  DELIVERED:
    "Mark this load delivered? Inventory is deducted and its structures are marked shipped.",
  CANCELLED: "Cancel this load? It disappears from dispatch panels.",
};

/**
 * Dispatch quick status change, e.g. from the Today's Loads panel.
 * Optimistic: the picked status shows immediately and the control stays
 * clickable while the action and router refresh run; on error it reverts.
 */
export function StatusSelect({ ticketId, status }: StatusSelectProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [value, setValue] = useState<DeliveryTicketStatus>(status);

  // Adopt server refreshes (e.g. edits from another screen) during render.
  const [prevStatus, setPrevStatus] = useState(status);
  if (status !== prevStatus) {
    setPrevStatus(status);
    setValue(status);
  }

  const nextStatuses = deliveryTicketStatusFlow[status] ?? [];
  if (nextStatuses.length === 0) {
    return (
      <StatusBadge
        label={deliveryTicketStatusLabels[status]}
        variant={deliveryTicketStatusVariant(status)}
      />
    );
  }

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as DeliveryTicketStatus;
    if (next === value) {
      return;
    }
    const confirmMessage = CONFIRM_MESSAGES[next];
    if (confirmMessage && !window.confirm(confirmMessage)) {
      // No state change means no re-render — reset the DOM select.
      event.target.value = value;
      return;
    }
    const previous = value;
    setValue(next);
    setError(null);
    setWarning(null);
    startTransition(async () => {
      const result = await updateDeliveryTicketStatus(ticketId, next);
      if ("error" in result && result.error) {
        setError(result.error);
        setValue(previous);
        return;
      }
      if ("warning" in result && result.warning) {
        setWarning(result.warning);
      }
      router.refresh();
    });
  }

  return (
    <div>
      <select
        value={value}
        onChange={handleChange}
        aria-label="Change load status"
        className={`block w-28 rounded-md border px-2 py-1 text-xs font-medium shadow-sm ${
          VARIANT_SELECT_STYLES[deliveryTicketStatusVariant(value)]
        } ${pending ? "opacity-60" : ""}`}
      >
        {[status, ...nextStatuses].includes(value) ? null : (
          <option value={value}>{deliveryTicketStatusLabels[value]}</option>
        )}
        <option value={status}>{deliveryTicketStatusLabels[status]}</option>
        {nextStatuses.map((next) => (
          <option key={next} value={next}>
            {deliveryTicketStatusLabels[next]}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 max-w-[12rem] text-[10px] text-red-600">{error}</p>
      ) : null}
      {warning ? (
        <p className="mt-1 max-w-[12rem] text-[10px] text-amber-700">{warning}</p>
      ) : null}
    </div>
  );
}
