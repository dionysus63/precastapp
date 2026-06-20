"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertTicketToInvoice } from "@/app/operations/actions";

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
  const router = useRouter();
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
            router.refresh();
          }
        })
      }
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      Convert to Invoice
    </button>
  );
}
