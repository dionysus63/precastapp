import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { JobFilesBrowser } from "@/components/files/job-files-browser";
import { mapFilesForBrowser } from "@/lib/job-file-mapper";
import { getJobFilesForBrowser } from "@/app/files/actions";
import { withDatabaseRetry } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
type JobFilesPageProps = {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ category?: string }>;
};

export default async function JobFilesPage({
  params,
  searchParams,
}: JobFilesPageProps) {
  const { jobId } = await params;
  const { category } = await searchParams;

  const jobRecord = await withDatabaseRetry((prisma) =>
    prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        jobNumber: true,
        customerName: true,
        projectName: true,
        folderPath: true,
      },
    }),
  );

  if (!jobRecord) {
    notFound();
  }

  let files: ReturnType<typeof mapFilesForBrowser> = [];

  if (jobRecord.folderPath) {
    try {
      const result = await getJobFilesForBrowser(
        jobId,
        category && category !== "All" ? category : undefined,
      );
      files = mapFilesForBrowser(result.files);
    } catch {
      files = [];
    }
  }

  return (
    <DashboardShell
      title={`Files — ${jobRecord.jobNumber}`}
      subtitle={`${jobRecord.projectName} — ${jobRecord.customerName}`}
    >
      <BackButton href="/files" label="Back to Files" />

      <div className="mt-4">
        <JobFilesBrowser
          jobId={jobRecord.id}
          jobNumber={jobRecord.jobNumber}
          customerName={jobRecord.customerName}
          projectName={jobRecord.projectName}
          folderPath={jobRecord.folderPath}
          files={files}
          activeCategory={category ?? "All"}
        />
      </div>
    </DashboardShell>
  );
}
