import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ReconcileDay } from "@/components/delivery-tickets/reconcile-day";
import { listTicketsForReconciliation } from "@/app/operations/actions";

type PageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function DeliveryTicketsReconcilePage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const date =
    params.date ?? new Date().toISOString().slice(0, 10);

  const { tickets, reconciliation } = await listTicketsForReconciliation(date);

  return (
    <DashboardShell
      title="Daily Ticket Reconciliation"
      subtitle="Confirm printed paper tickets match digital delivery tickets."
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/delivery-tickets"
          className="text-xs text-slate-600 hover:text-slate-900"
        >
          ← Back to Delivery Tickets
        </Link>
        <form method="get" className="flex items-center gap-2">
          <label htmlFor="date" className="text-xs text-slate-600">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={date}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
          >
            Go
          </button>
        </form>
      </div>

      <ReconcileDay
        date={date}
        tickets={tickets}
        reconciliation={reconciliation}
      />
    </DashboardShell>
  );
}
