"use client";

import { useState, useTransition } from "react";
import { updateDeliveryTicketStatus } from "@/app/delivery-tickets/actions";
import { reloadAfterAction } from "@/lib/reload-after-action";
import type { DeliveryTicketStatus } from "@/components/delivery-tickets/delivery-ticket-utils";

type TicketStatusActionsProps = {
  ticketId: string;
  status: string;
  hasInvoice: boolean;
};

export function TicketStatusActions({
  ticketId,
  status,
}: TicketStatusActionsProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(next: DeliveryTicketStatus) {
    startTransition(async () => {
      setMessage(null);
      const result = await updateDeliveryTicketStatus(ticketId, next);
      if ("error" in result && result.error) {
        setMessage(result.error);
        return;
      }
      if ("warning" in result && result.warning) {
        setMessage(result.warning);
      }
      reloadAfterAction();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("SCHEDULED")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Schedule
        </button>
      ) : null}
      {status === "SCHEDULED" || status === "LOADING" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("IN_TRANSIT")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Mark In Transit
        </button>
      ) : null}
      {status !== "DELIVERED" && status !== "CANCELLED" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run("DELIVERED")}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          Mark Delivered
        </button>
      ) : null}
      {message ? (
        <span className="w-full text-[10px] text-amber-700">{message}</span>
      ) : null}
    </div>
  );
}
