"use client";

import { useState, useTransition } from "react";
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
  const [error, setError] = useState<string | null>(null);

  if (status !== "DELIVERED" || hasInvoice) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await convertTicketToInvoice(ticketId);
            if (result.invoiceId) {
              reloadAfterAction();
            } else if (result.error) {
              setError(result.error);
            }
          })
        }
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Convert to Invoice
      </button>
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </>
  );
}
