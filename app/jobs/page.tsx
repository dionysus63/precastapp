import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { JobsList } from "@/components/jobs/jobs-list";
import { mapJobToRow } from "@/lib/job-mapper";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function JobsPage() {
  const jobs = await withDatabaseRetry((prisma) =>
    prisma.job.findMany({
      orderBy: [{ year: "desc" }, { sequenceNumber: "desc" }],
    }),
  );

  const rows = jobs.map(mapJobToRow);

  return (
    <DashboardShell
      title="Jobs"
      subtitle="Track projects, bids, and job folders across your precast operation."
    >
      <JobsList jobs={rows} />
    </DashboardShell>
  );
}
