import { DashboardShell } from "@/components/dashboard/dashboard-shell";

import { BackButton } from "@/components/dashboard/back-button";
export default function JobNotFound() {
  return (
    <DashboardShell
      title="Job Not Found"
      subtitle="The requested job could not be found."
    >
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          This job may have been removed, or the link may be incorrect.
        </p>
        <BackButton href="/jobs" label="Back to Jobs" />
      </div>
    </DashboardShell>
  );
}
