import { DashboardShell } from "@/components/dashboard/dashboard-shell";

import { BackButton } from "@/components/dashboard/back-button";
export default function QuoteNotFound() {
  return (
    <DashboardShell
      title="Quote Not Found"
      subtitle="The requested quote could not be found."
    >
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          This quote may have been removed, or the link may be incorrect.
        </p>
        <BackButton href="/quotes" label="Back to Quotes" />
      </div>
    </DashboardShell>
  );
}
