"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  cancelTicketFromReconcile,
  confirmDeliveryDayReconciliation,
  deliverAllTicketsForDay,
  deliverTicket,
  moveTicketDeliveryDate,
} from "@/app/operations/actions";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";
export type ReconcileTicket = {
  id: string;
  ticketNumber: string;
  customerName: string;
  projectName: string;
  status: string;
  deliveryDate: Date | null;
  deliveredAt: Date | null;
  ticketType: string;
  paymentMethod: string | null;
  paymentReceived: boolean;
  paperTicketPrinted: boolean;
  hasInvoice: boolean;
};

type ReconcileDayProps = {
  date: string;
  scheduledTickets: ReconcileTicket[];
  deliveredOtherDayTickets: ReconcileTicket[];
  reconciliation: {
    confirmedBy: string | null;
    confirmedAt: Date | null;
    notes: string | null;
  } | null;
  canManageInvoices: boolean;
};

function formatDateOnly(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function getMismatchFlags(ticket: ReconcileTicket): string[] {
  const flags: string[] = [];
  if (
    ticket.paperTicketPrinted &&
    ticket.status !== "DELIVERED" &&
    ticket.status !== "CANCELLED"
  ) {
    flags.push("Printed but not delivered");
  }
  if (
    ticket.ticketType === "WALK_IN" &&
    ticket.paymentMethod === "PAY_NOW" &&
    !ticket.paymentReceived
  ) {
    flags.push("Payment expected at pickup — not received");
  }
  return flags;
}

function TicketQuickActions({
  ticket,
  reconcileDate,
}: {
  ticket: ReconcileTicket;
  reconcileDate: string;
}) {
  const confirmDialog = useConfirm();
  const [pending, startTransition] = useTransition();
  const [moveDate, setMoveDate] = useState(
    ticket.deliveryDate
      ? ticket.deliveryDate.toISOString().slice(0, 10)
      : reconcileDate,
  );
  const [message, setMessage] = useState<string | null>(null);

  const canDeliver =
    ticket.status !== "DELIVERED" && ticket.status !== "CANCELLED";
  const canCancel =
    ticket.status !== "DELIVERED" && ticket.status !== "CANCELLED";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canDeliver ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await deliverTicket(ticket.id);
                setMessage(result.error ?? result.warning ?? "Marked delivered.");
              });
            }}
            className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            Mark delivered
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              if (
                !(await confirmDialog({
                  title: "Cancel ticket?",
                  message: `Cancel ticket ${ticket.ticketNumber}?`,
                  confirmLabel: "Cancel ticket",
                  variant: "danger",
                }))
              ) {
                return;
              }
              startTransition(async () => {
                const result = await cancelTicketFromReconcile(ticket.id);
                setMessage(result.error ?? "Ticket cancelled.");
              });
            }}
            className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            Cancel
          </button>
        ) : null}
        <Link
          href={`/delivery-tickets/${ticket.id}`}
          className="text-[11px] text-slate-700 underline hover:text-slate-900"
        >
          View
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <input
          type="date"
          value={moveDate}
          onChange={(event) => setMoveDate(event.target.value)}
          className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px]"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await moveTicketDeliveryDate(ticket.id, moveDate);
              setMessage(result.error ?? "Date updated.");
            });
          }}
          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] hover:bg-slate-50 disabled:opacity-50"
        >
          Move date
        </button>
      </div>
      {message ? (
        <p className="text-[10px] text-slate-500">{message}</p>
      ) : null}
    </div>
  );
}

function TicketTable({
  tickets,
  reconcileDate,
  showScheduledDate,
  emptyMessage,
}: {
  tickets: ReconcileTicket[];
  reconcileDate: string;
  showScheduledDate?: boolean;
  emptyMessage: string;
}) {
  if (tickets.length === 0) {
    return <p className="px-4 py-6 text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className={tableFlushWrapperClassName}>
      <table className={tableClassName}>
        <thead>
          <tr>
            <th className={tableHeaderCellClassName}>Ticket</th>
            <th className={tableHeaderCellClassName}>Customer</th>
            <th className={tableHeaderCellClassName}>Status</th>
            {showScheduledDate ? (
              <th className={tableHeaderCellClassName}>Scheduled</th>
            ) : null}
            <th className={tableHeaderCellClassName}>Flags</th>
            <th className={tableHeaderCellClassName}>Actions</th>
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {tickets.map((ticket) => {
            const flags = getMismatchFlags(ticket);
            return (
              <tr key={ticket.id}>
                <td className={`${tableCellClassName} font-medium`}>
                  {ticket.ticketNumber}
                  {ticket.hasInvoice ? (
                    <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-normal text-sky-800">
                      Invoiced
                    </span>
                  ) : null}
                  {ticket.ticketType === "WALK_IN" ? (
                    <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-normal text-violet-800">
                      Walk-in
                    </span>
                  ) : null}
                </td>
                <td className={tableCellClassName}>
                  {ticket.customerName}
                  <span className="block text-slate-500">{ticket.projectName}</span>
                </td>
                <td className={tableCellClassName}>
                  <StatusBadge label={ticket.status.replace(/_/g, " ")} />
                </td>
                {showScheduledDate ? (
                  <td className={`${tableCellClassName} text-slate-600`}>
                    {formatDateOnly(ticket.deliveryDate)}
                  </td>
                ) : null}
                <td className={tableCellClassName}>
                  {flags.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {flags.map((flag) => (
                        <li
                          key={flag}
                          className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800"
                        >
                          {flag}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className={tableCellClassName}>
                  <TicketQuickActions
                    ticket={ticket}
                    reconcileDate={reconcileDate}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ReconcileDay({
  date,
  scheduledTickets,
  deliveredOtherDayTickets,
  reconciliation,
  canManageInvoices,
}: ReconcileDayProps) {
  const confirmDialog = useConfirm();
  const [pending, startTransition] = useTransition();
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [deliverAllPending, startDeliverAllTransition] = useTransition();
  const [deliverAllMessage, setDeliverAllMessage] = useState<string | null>(
    null,
  );

  const allTickets = [...scheduledTickets, ...deliveredOtherDayTickets];
  const warningFlags = allTickets.flatMap(getMismatchFlags);
  const hasWarnings = warningFlags.length > 0;
  const deliveredUninvoiced = allTickets.filter(
    (ticket) => ticket.status === "DELIVERED" && !ticket.hasInvoice,
  ).length;
  // The bookkeeper counts paper tickets against these numbers.
  const deliveredCount = allTickets.filter(
    (ticket) => ticket.status === "DELIVERED",
  ).length;
  const openTickets = scheduledTickets.filter(
    (ticket) => ticket.status !== "DELIVERED" && ticket.status !== "CANCELLED",
  );

  function handleDeliverAll() {
    void (async () => {
      if (
        !(await confirmDialog({
          title: "Mark all delivered?",
          message: `Mark ${openTickets.length} open ticket${
            openTickets.length === 1 ? "" : "s"
          } on ${date} as delivered? Stock is deducted and structures are marked shipped.`,
          confirmLabel: "Mark all delivered",
        }))
      ) {
        return;
      }
      setDeliverAllMessage(null);
      startDeliverAllTransition(async () => {
        const result = await deliverAllTicketsForDay(date);
        if (!("success" in result)) {
          setDeliverAllMessage(result.error ?? "Could not mark the day delivered.");
          return;
        }
        const parts = [
          `${result.delivered} ticket${result.delivered === 1 ? "" : "s"} marked delivered.`,
        ];
        if (result.failed.length > 0) {
          parts.push(
            `${result.failed.length} failed: ${result.failed
              .map((item) => `${item.ticketNumber} (${item.error})`)
              .join("; ")}`,
          );
        }
        parts.push(...result.warnings);
        setDeliverAllMessage(parts.join(" "));
      });
    })();
  }

  return (
    <div className="space-y-5">
      <SectionCard
        title={`Scheduled for ${date}`}
        description={`${allTickets.length} ticket${allTickets.length === 1 ? "" : "s"} on this day · ${deliveredCount} delivered — the paper folder should match.`}
        action={
          openTickets.length > 0 ? (
            <button
              type="button"
              disabled={deliverAllPending}
              onClick={handleDeliverAll}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              {deliverAllPending
                ? "Marking…"
                : `Mark all ${openTickets.length} delivered`}
            </button>
          ) : undefined
        }
        noPadding
      >
        {deliverAllMessage ? (
          <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-700">
            {deliverAllMessage}
          </p>
        ) : null}
        <TicketTable
          tickets={scheduledTickets}
          reconcileDate={date}
          emptyMessage="No delivery tickets scheduled for this date."
        />
      </SectionCard>

      {deliveredOtherDayTickets.length > 0 ? (
        <SectionCard
          title={`Delivered on ${date} but scheduled another day`}
          noPadding
        >
          <TicketTable
            tickets={deliveredOtherDayTickets}
            reconcileDate={date}
            showScheduledDate
            emptyMessage=""
          />
        </SectionCard>
      ) : null}

      <SectionCard title="Confirm day & create draft invoices">
        {reconciliation ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-700">
              Confirmed by {reconciliation.confirmedBy} on{" "}
              {reconciliation.confirmedAt
                ? new Date(reconciliation.confirmedAt).toLocaleString()
                : "—"}
              {reconciliation.notes ? ` — ${reconciliation.notes}` : ""}
            </p>
            {resultMessage ? (
              <p className="text-sm text-slate-700">{resultMessage}</p>
            ) : null}
            {canManageInvoices && deliveredUninvoiced > 0 ? (
              <p className="text-xs text-slate-600">
                {deliveredUninvoiced} delivered ticket
                {deliveredUninvoiced === 1 ? " still needs" : "s still need"} a
                draft invoice. Re-run confirm below to create them.
              </p>
            ) : null}
          </div>
        ) : null}

        {hasWarnings ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>Review before confirming:</strong>{" "}
            {warningFlags.length} issue
            {warningFlags.length === 1 ? "" : "s"} flagged on this day&apos;s
            tickets. You can still confirm, but double-check paper tickets
            first.
          </div>
        ) : null}

        <div className="grid max-w-md gap-3">
          {canManageInvoices ? (
            <p className="text-xs text-slate-600">
              Confirming stamps the day with your name and creates draft
              invoices for delivered tickets ({deliveredUninvoiced} ready).
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              You need invoice permissions to create draft invoices from this
              page.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || allTickets.length === 0}
              onClick={() => {
                startTransition(async () => {
                  const result = await confirmDeliveryDayReconciliation(date);
                  if (result.error) {
                    setResultMessage(result.error);
                    return;
                  }
                  const parts: string[] = ["Day confirmed."];
                  if (result.conversionResult) {
                    const { created, skipped, alreadyInvoiced } =
                      result.conversionResult;
                    parts.push(
                      `${created} draft invoice${created === 1 ? "" : "s"} created.`,
                    );
                    if (alreadyInvoiced > 0) {
                      parts.push(`${alreadyInvoiced} already invoiced.`);
                    }
                    if (skipped.length > 0) {
                      parts.push(
                        `${skipped.length} skipped: ${skipped
                          .map(
                            (item: { ticketNumber: string; reason: string }) =>
                              `${item.ticketNumber} (${item.reason})`,
                          )
                          .join("; ")}`,
                      );
                    }
                  } else if (canManageInvoices) {
                    parts.push("No new draft invoices were created.");
                  }
                  setResultMessage(parts.join(" "));
                });
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {pending ? "Confirming…" : "Confirm day & create draft invoices"}
            </button>
            {resultMessage ? (
              <Link
                href="/invoices?tab=drafts"
                className="text-xs font-medium text-sky-700 underline hover:text-sky-900"
              >
                Go to Draft Review →
              </Link>
            ) : null}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
