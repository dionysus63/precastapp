"use client";

import { useTransition } from "react";
import { convertTicketToInvoice } from "@/app/operations/actions";
import { reloadAfterAction } from "@/lib/reload-after-action";

type TicketOperationsPanelProps = {
  ticketId: string;
  status: string;
  hasInvoice: boolean;
};

export function TicketOperationsPanel({
  ticketId,
  status,
  hasInvoice,
}: TicketOperationsPanelProps) {
  const [pending, startTransition] = useTransition();

  if (status !== "DELIVERED" || hasInvoice) {
    return null;
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await convertTicketToInvoice(ticketId);
          if (result.invoiceId) {
            reloadAfterAction();
          }
        })
      }
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      Convert to Invoice
    </button>
  );
}
