import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { JobStructureForm } from "@/components/jobs/job-structure-form";
import { withDatabaseRetry } from "@/lib/prisma";

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
      <Link
        href={`/jobs/${job.id}?tab=production`}
        className="text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Job
      </Link>

      <div className="mt-4">
        <JobStructureForm jobId={job.id} jobNumber={job.jobNumber} />
      </div>
    </DashboardShell>
  );
}
