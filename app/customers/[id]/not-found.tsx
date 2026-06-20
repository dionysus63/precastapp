import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function CustomerNotFound() {
  return (
    <DashboardShell
      title="Customer Not Found"
      subtitle="The requested customer could not be found."
    >
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          This customer may have been removed, or the link may be incorrect.
        </p>
        <Link
          href="/customers"
          className="mt-4 inline-flex rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Back to Customers
        </Link>
      </div>
    </DashboardShell>
  );
}
