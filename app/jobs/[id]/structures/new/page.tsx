import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { JobStructureForm } from "@/components/jobs/job-structure-form";
import { withDatabaseRetry } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
type NewJobStructurePageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewJobStructurePage({
  params,
}: NewJobStructurePageProps) {
  const { id } = await params;

  const job = await withDatabaseRetry((prisma) =>
    prisma.job.findUnique({
      where: { id },
      select: { id: true, jobNumber: true, projectName: true },
    }),
  );

  if (!job) {
    notFound();
  }

  return (
    <DashboardShell
      title={`New Structure — ${job.jobNumber}`}
      subtitle={`Add a structure to ${job.projectName}.`}
    >
      <BackButton href={`/jobs/${job.id}?tab=production`} label="Back to Job" />

      <div className="mt-4">
        <JobStructureForm jobId={job.id} jobNumber={job.jobNumber} />
      </div>
    </DashboardShell>
  );
}
