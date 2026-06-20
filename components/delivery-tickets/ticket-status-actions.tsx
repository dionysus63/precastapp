"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateDeliveryTicketStatus } from "@/app/delivery-tickets/actions";
import type { DeliveryTicketStatus } from "@/components/delivery-tickets/delivery-ticket-utils";

type TicketStatusActionsProps = {
  ticketId: string;
  status: string;
  hasInvoice: boolean;
};

export function TicketStatusActions({
  ticketId,
  status,
  hasInvoice,
}: TicketStatusActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(next: DeliveryTicketStatus) {
    startTransition(async () => {
      await updateDeliveryTicketStatus(ticketId, next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
