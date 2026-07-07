"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { convertTicketToInvoice } from "@/app/operations/actions";
import type { JobInvoiceableDelivery } from "@/components/jobs/job-utils";

type JobInvoiceActionsProps = {
  deliveries: JobInvoiceableDelivery[];
};

export function JobInvoiceActions({ deliveries }: JobInvoiceActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleConvert(ticketId: string) {
    setError(null);
    setBusyId(ticketId);
    startTransition(async () => {
      const result = await convertTicketToInvoice(ticketId);
      setBusyId(null);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  // Parent only renders this when there are un-invoiced delivered tickets.
  return (
    <SectionCard
      title="Create Invoice"
      description={`${deliveries.length} delivered ticket${deliveries.length === 1 ? "" : "s"} ready to invoice`}
      noPadding
    >
      <div>
        {deliveries.map((ticket) => (
          <div
            key={ticket.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-2 last:border-b-0"
          >
            <div className="text-xs">
              <span className="font-medium text-slate-900">
                {ticket.ticketNumber}
              </span>
              <span className="text-slate-600"> — {ticket.projectName}</span>
              <span className="text-slate-500"> · {ticket.deliveryDate}</span>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleConvert(ticket.id)}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {pending && busyId === ticket.id ? "Creating…" : "Create Invoice"}
            </button>
          </div>
        ))}
      </div>
      {error ? (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </SectionCard>
  );
}
