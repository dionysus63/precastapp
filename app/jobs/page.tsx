import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { JobsList } from "@/components/jobs/jobs-list";
import { getFavoriteJobIdsForUser } from "@/lib/job-favorites";
import { mapJobToRow } from "@/lib/job-mapper";
import { getCurrentUser } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";

export default async function JobsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const [jobs, favoriteJobIds] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.job.findMany({
        orderBy: [{ year: "desc" }, { sequenceNumber: "desc" }],
      }),
    ),
    getFavoriteJobIdsForUser(user.id),
  ]);

  const rows = jobs.map(mapJobToRow);

  return (
    <DashboardShell
      title="Jobs"
      subtitle="Track projects, bids, and job folders across your precast operation."
    >
      <JobsList jobs={rows} favoriteJobIds={favoriteJobIds} />
    </DashboardShell>
  );
}
