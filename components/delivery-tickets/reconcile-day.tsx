"use client";

import { useTransition } from "react";
import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  confirmDeliveryDayReconciliation,
  updateTicketPaperVerification,
} from "@/app/operations/actions";

export type ReconcileTicket = {
  id: string;
  ticketNumber: string;
  customerName: string;
  projectName: string;
  status: string;
  paperTicketPrinted: boolean;
  paperTicketVerified: boolean;
  verifiedBy: string | null;
};

type ReconcileDayProps = {
  date: string;
  tickets: ReconcileTicket[];
  reconciliation: {
    confirmedBy: string | null;
    confirmedAt: Date | null;
    notes: string | null;
  } | null;
};

function TicketVerificationForm({ ticket }: { ticket: ReconcileTicket }) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(() => {
          void updateTicketPaperVerification(ticket.id, formData);
        });
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <label className="flex items-center gap-1.5 text-[11px]">
        <input
          type="checkbox"
          name="paperTicketPrinted"
          defaultChecked={ticket.paperTicketPrinted}
        />
        Printed
      </label>
      <label className="flex items-center gap-1.5 text-[11px]">
        <input
          type="checkbox"
          name="paperTicketVerified"
          defaultChecked={ticket.paperTicketVerified}
        />
        Verified
      </label>
      <input
        type="text"
        name="verifiedBy"
        placeholder="Verified by"
        defaultValue={ticket.verifiedBy ?? ""}
        className="w-24 rounded border border-slate-200 px-1.5 py-0.5 text-[11px]"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-slate-200 px-2 py-0.5 text-[11px] hover:bg-slate-50 disabled:opacity-50"
      >
        Save
      </button>
    </form>
  );
}

export function ReconcileDay({ date, tickets, reconciliation }: ReconcileDayProps) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      <SectionCard title={`Tickets for ${date}`} noPadding>
        {tickets.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No delivery tickets scheduled for this date.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
                <tr>
                  <th className="px-4 py-2 font-semibold">Ticket</th>
                  <th className="px-4 py-2 font-semibold">Customer</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Paper verification</th>
                  <th className="px-4 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="px-4 py-2 font-medium">{ticket.ticketNumber}</td>
                    <td className="px-4 py-2">
                      {ticket.customerName}
                      <span className="block text-slate-500">{ticket.projectName}</span>
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge label={ticket.status.replace(/_/g, " ")} />
                    </td>
                    <td className="px-4 py-2">
                      <TicketVerificationForm ticket={ticket} />
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/delivery-tickets/${ticket.id}`}
                        className="text-slate-700 underline hover:text-slate-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Confirm day">
        {reconciliation ? (
          <p className="text-sm text-emerald-700">
            Confirmed by {reconciliation.confirmedBy} on{" "}
            {reconciliation.confirmedAt
              ? new Date(reconciliation.confirmedAt).toLocaleString()
              : "—"}
            {reconciliation.notes ? ` — ${reconciliation.notes}` : ""}
          </p>
        ) : (
          <form
            action={(formData) => {
              startTransition(() => {
                void confirmDeliveryDayReconciliation(formData);
              });
            }}
            className="grid max-w-md gap-3"
          >
            <input type="hidden" name="reconciliationDate" value={date} />
            <div>
              <label htmlFor="confirmedBy" className="text-xs font-medium text-slate-700">
                Confirmed by
              </label>
              <input
                id="confirmedBy"
                name="confirmedBy"
                required
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="notes" className="text-xs font-medium text-slate-700">
                Notes
              </label>
              <input
                id="notes"
                name="notes"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={pending || tickets.length === 0}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Confirm all paper tickets match
            </button>
          </form>
        )}
      </SectionCard>
    </div>
  );
}
