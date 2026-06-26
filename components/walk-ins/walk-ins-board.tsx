import Link from "next/link";
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

function PickupCardBody({ row }: { row: WalkInRow }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{row.ticketNumber}</p>
          <p className="text-xs text-slate-600">{row.customerName}</p>
        </div>
        <StatusBadge
          label={row.status.replace(/_/g, " ")}
          variant={statusVariant(row.status)}
        />
      </div>

      <p className="mt-1 text-xs text-slate-500">
        {row.ticketType === "JOB"
          ? `${row.jobNumber ?? "Job"} · ${row.projectName}`
          : row.projectName}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {row.dateLabel ? (
          <span>
            {row.dateLabel}
            {row.timeLabel ? ` · ${row.timeLabel}` : ""}
          </span>
        ) : (
          <span>No date set</span>
        )}
        {row.totalItems != null ? <span>{row.totalItems} item(s)</span> : null}
        <span
          className={
            row.paymentReceived
              ? "font-medium text-green-700"
              : "font-medium text-slate-600"
          }
        >
          {paymentLabel(row)}
        </span>
        {row.pickedUpBy ? <span>Pickup: {row.pickedUpBy}</span> : null}
      </div>
    </>
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
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
        >
          New Walk-In Sale
        </Link>
        <Link
          href="/delivery-tickets/new?fulfillment=pickup"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          New Pickup Ticket
        </Link>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">
          Called-in pickups
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Pre-arranged orders waiting for the customer. Use preview links to
          print the ticket and submittals.
        </p>
        {calledIn.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
            No pickups are waiting right now.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {calledIn.map((row) => (
              <CalledInPickupCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900">
          Recently completed
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Walk-ins and pickups handled recently.
        </p>
        {completed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
            Nothing completed yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((row) => (
              <CompletedPickupCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
