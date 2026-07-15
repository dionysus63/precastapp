import { DashboardShell } from "@/components/dashboard/dashboard-shell";

import { BackButton } from "@/components/dashboard/back-button";
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
        <BackButton href="/customers" label="Back to Customers" />
      </div>
    </DashboardShell>
  );
}
