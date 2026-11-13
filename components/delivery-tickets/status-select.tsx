"use client";

import { useState, useTransition } from "react";
import type { DeliveryTicketStatus } from "@/app/generated/prisma/client";
import {
  getUndoDeliveryImpact,
  updateDeliveryTicketStatus,
} from "@/app/delivery-tickets/actions";
import {
  deliveryTicketStatusFlow,
  deliveryTicketStatusLabels,
} from "@/components/delivery-tickets/delivery-ticket-utils";
import { deliveryTicketStatusVariant } from "@/lib/status-variants";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { isUnpaidInvoiceStatus } from "@/lib/invoice-status";
import { reloadAfterAction } from "@/lib/reload-after-action";

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

type ConfirmCopy = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
};

// Delivered deducts inventory and makes the invoice, and cancelled has no way
// back from this dropdown, so both get a confirm before the action fires.
const CONFIRM_COPY: Partial<Record<DeliveryTicketStatus, ConfirmCopy>> = {
  DELIVERED: {
    title: "Mark delivered?",
    message:
      "Mark this load delivered? Inventory is deducted, its structures are marked shipped, and its invoice is made.",
    confirmLabel: "Mark delivered",
  },
  CANCELLED: {
    title: "Cancel load?",
    message: "Cancel this load? It disappears from dispatch panels.",
    confirmLabel: "Cancel load",
    danger: true,
  },
};

/** Leaving DELIVERED undoes the delivery — say what that does. */
const UNDO_CONFIRM_COPY: Partial<Record<DeliveryTicketStatus, ConfirmCopy>> = {
  SCHEDULED: {
    title: "Undo delivery?",
    message:
      "Undo this delivery? Inventory is put back, its structures return to Made, and the load goes back to Scheduled.",
    confirmLabel: "Undo delivery",
    danger: true,
  },
  CANCELLED: {
    title: "Undo delivery and cancel load?",
    message:
      "Undo this delivery and cancel the load? Inventory is put back and its structures return to Made.",
    confirmLabel: "Undo and cancel",
    danger: true,
  },
};

/**
 * Dispatch quick status change, e.g. from the Today's Loads panel.
 * Optimistic: the picked status shows immediately and the control stays
 * clickable while the action and router refresh run; on error it reverts.
 */
export function StatusSelect({ ticketId, status }: StatusSelectProps) {
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  // True while the dialog (or the invoice check before it) is up, so a
  // second pick cannot start underneath it.
  const [asking, setAsking] = useState(false);
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

  /**
   * Ask before a change that needs it. Resolves null when the user backed
   * out (or the change is not allowed), otherwise the options to send.
   */
  async function confirmChange(
    next: DeliveryTicketStatus,
  ): Promise<{ removeUnpaidInvoice: boolean } | null> {
    if (value !== "DELIVERED") {
      const copy = CONFIRM_COPY[next];
      if (!copy) {
        return { removeUnpaidInvoice: false };
      }
      const ok = await confirm({
        title: copy.title,
        message: copy.message,
        confirmLabel: copy.confirmLabel,
        cancelLabel: "Go back",
        variant: copy.danger ? "danger" : "default",
      });
      return ok ? { removeUnpaidInvoice: false } : null;
    }

    const copy = UNDO_CONFIRM_COPY[next];
    if (!copy) {
      return { removeUnpaidInvoice: false };
    }
    // The invoice was made when this load was marked delivered, so undoing
    // the delivery takes it away again. Say so before anything changes.
    const impact = await getUndoDeliveryImpact(ticketId);
    if ("error" in impact) {
      setError(impact.error);
      return null;
    }
    const invoice = impact.invoice;
    if (invoice?.status === "PAID") {
      setError(
        `Invoice ${invoice.invoiceNumber} for this delivery is paid. Void the invoice first, then undo the delivery.`,
      );
      return null;
    }
    const removesInvoice = invoice != null && isUnpaidInvoiceStatus(invoice.status);
    const invoiceNote = !invoice
      ? ""
      : removesInvoice
        ? `\n\nInvoice ${invoice.invoiceNumber} for this delivery is deleted too, with any prices typed on it.${
            next === "SCHEDULED"
              ? " Marking the load delivered again makes a new invoice."
              : ""
          }`
        : `\n\nVoided invoice ${invoice.invoiceNumber} stays on file.`;
    const ok = await confirm({
      title: copy.title,
      message: `${copy.message}${invoiceNote}`,
      confirmLabel: removesInvoice
        ? `${copy.confirmLabel}, delete invoice`
        : copy.confirmLabel,
      cancelLabel: "Go back",
      variant: "danger",
    });
    return ok ? { removeUnpaidInvoice: removesInvoice } : null;
  }

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const select = event.currentTarget;
    const next = select.value as DeliveryTicketStatus;
    if (next === value || asking) {
      select.value = value;
      return;
    }
    const previous = value;
    setError(null);
    setWarning(null);
    setAsking(true);
    void (async () => {
      let options: { removeUnpaidInvoice: boolean } | null = null;
      try {
        options = await confirmChange(next);
      } finally {
        setAsking(false);
      }
      if (!options) {
        // No state change means no re-render — reset the DOM select.
        select.value = previous;
        return;
      }
      const sendOptions = options;
      setValue(next);
      startTransition(async () => {
        const result = await updateDeliveryTicketStatus(
          ticketId,
          next,
          sendOptions,
        );
        if ("error" in result && result.error) {
          setError(result.error);
          setValue(previous);
          return;
        }
        // Reload so the rest of the page (other loads, counts) reflects the
        // change; an invoice warning carries over instead of vanishing.
        if ("warning" in result && result.warning) {
          reloadAfterAction({ type: "warning", text: result.warning });
          return;
        }
        reloadAfterAction(
          "invoiceMade" in result && result.invoiceMade
            ? {
                type: "success",
                text: `Marked delivered. Invoice ${result.invoiceMade} is ready on the Invoices screen.`,
              }
            : undefined,
        );
      });
    })();
  }

  return (
    <div>
      <select
        value={value}
        onChange={handleChange}
        aria-label="Change load status"
        disabled={asking}
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
        <p className="mt-1 max-w-[12rem] text-3xs text-red-600">{error}</p>
      ) : null}
      {warning ? (
        <p className="mt-1 max-w-[12rem] text-3xs text-amber-700">{warning}</p>
      ) : null}
    </div>
  );
}
