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

  return (
    <SectionCard
      title="Create Invoice"
      description="Invoices are generated from delivered delivery tickets."
    >
      {deliveries.length === 0 ? (
        <p className="text-xs text-slate-500">
          No delivered, un-invoiced delivery tickets for this job. Mark a
          delivery ticket as delivered to create an invoice from it.
        </p>
      ) : (
        <ul className="space-y-2">
          {deliveries.map((ticket) => (
            <li
              key={ticket.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
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
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </SectionCard>
  );
}
