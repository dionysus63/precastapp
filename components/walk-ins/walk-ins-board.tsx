import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { MarkPickedUpControl } from "@/components/walk-ins/mark-picked-up-control";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "DELIVERED":
      return "success";
    case "CANCELLED":
      return "danger";
    case "IN_TRANSIT":
    case "LOADING":
      return "info";
    case "SCHEDULED":
      return "warning";
    default:
      return "neutral";
  }
}

export type WalkInRow = {
  id: string;
  ticketNumber: string;
  ticketType: "JOB" | "WALK_IN";
  customerName: string;
  projectName: string;
  jobNumber: string | null;
  status: string;
  dateLabel: string | null;
  timeLabel: string | null;
  totalItems: number | null;
  paymentMethod: "PAY_NOW" | "ON_ACCOUNT" | null;
  paymentReceived: boolean;
  pickedUpBy: string | null;
};

function paymentLabel(row: WalkInRow): string {
  if (row.paymentMethod === "PAY_NOW") {
    return row.paymentReceived ? "Paid" : "Pay on pickup";
  }
  if (row.paymentMethod === "ON_ACCOUNT") {
    return "On account";
  }
  return "Payment TBD";
}

function jobNameLine(row: WalkInRow): string {
  if (row.ticketType === "JOB") {
    if (row.jobNumber && row.projectName) {
      return `${row.jobNumber} — ${row.projectName}`;
    }
    return row.projectName || row.jobNumber || "Job pickup";
  }
  return row.projectName || "Walk-in sale";
}

function dateLine(row: WalkInRow): string {
  if (!row.dateLabel) {
    return "No date set";
  }
  return row.timeLabel ? `${row.dateLabel} · ${row.timeLabel}` : row.dateLabel;
}

function itemsPaymentLine(row: WalkInRow): string {
  const items =
    row.totalItems != null
      ? `${row.totalItems} item${row.totalItems === 1 ? "" : "s"}`
      : null;
  const payment = paymentLabel(row);
  return items ? `${items} · ${payment}` : payment;
}

const tileLineClass = "text-xs leading-5 text-slate-700";

function PickupCardBody({ row }: { row: WalkInRow }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-0">
        <p className={`${tileLineClass} font-semibold text-slate-900`}>
          {row.customerName}
        </p>
        <p className={tileLineClass}>{jobNameLine(row)}</p>
        <p className={tileLineClass}>{dateLine(row)}</p>
        <p className={tileLineClass}>{row.ticketNumber}</p>
        <p
          className={`${tileLineClass} ${
            row.paymentReceived ? "text-green-700" : ""
          }`}
        >
          {itemsPaymentLine(row)}
        </p>
        {row.pickedUpBy ? (
          <p className={tileLineClass}>Picked up by {row.pickedUpBy}</p>
        ) : null}
      </div>
      <StatusBadge
        label={row.status.replace(/_/g, " ")}
        variant={statusVariant(row.status)}
      />
    </div>
  );
}

function CalledInPickupCard({ row }: { row: WalkInRow }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <PickupCardBody row={row} />

      {row.status === "SCHEDULED" ? (
        <MarkPickedUpControl ticketId={row.id} ticketNumber={row.ticketNumber} />
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <Link
          href={`/delivery-tickets/${row.id}/preview?from=walk-ins`}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Preview Ticket
        </Link>
        <Link
          href={`/delivery-tickets/${row.id}/submittals/preview?from=walk-ins`}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Preview Submittals
        </Link>
      </div>
    </div>
  );
}

function CompletedPickupCard({ row }: { row: WalkInRow }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <PickupCardBody row={row} />
    </div>
  );
}

function PickupTileSection({
  title,
  description,
  emptyMessage,
  rows,
  renderCard,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  rows: WalkInRow[];
  renderCard: (row: WalkInRow) => ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mb-3 text-xs text-slate-500">{description}</p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => renderCard(row))}
        </div>
      )}
    </section>
  );
}

const newTicketLinkClass =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50";

export function WalkInsBoard({
  calledIn,
  completed,
}: {
  calledIn: WalkInRow[];
  completed: WalkInRow[];
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/delivery-tickets/new?type=walkin"
          className={newTicketLinkClass}
        >
          New Walk-In Sale
        </Link>
        <Link
          href="/delivery-tickets/new?fulfillment=pickup"
          className={newTicketLinkClass}
        >
          New Pickup Ticket
        </Link>
      </div>

      <PickupTileSection
        title="Called-in pickups"
        description="Pre-arranged orders waiting for the customer. Use preview links to print the ticket and submittals."
        emptyMessage="No pickups are waiting right now."
        rows={calledIn}
        renderCard={(row) => <CalledInPickupCard key={row.id} row={row} />}
      />

      <PickupTileSection
        title="Recently completed"
        description="Walk-ins and pickups handled recently."
        emptyMessage="Nothing completed yet."
        rows={completed}
        renderCard={(row) => <CompletedPickupCard key={row.id} row={row} />}
      />
    </div>
  );
}
