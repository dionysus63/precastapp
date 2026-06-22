import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

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
        <Link
          href="/jobs"
          className="mt-4 inline-flex rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Back to Jobs
        </Link>
      </div>
    </DashboardShell>
  );
}
