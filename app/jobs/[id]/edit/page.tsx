import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { JobFilesPreview } from "@/components/files/job-files-preview";
import { JobForm } from "@/components/jobs/job-form";
import { formatJobDateInput } from "@/components/jobs/job-utils";
import { updateJob } from "@/app/jobs/actions";
import { listJobFiles } from "@/lib/job-files-service";
import { mapJobFileRecordToRow } from "@/lib/job-file-mapper";
import { withDatabaseRetry } from "@/lib/prisma";

type EditJobPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditJobPage({ params }: EditJobPageProps) {
  const { id } = await params;

  const job = await withDatabaseRetry((prisma) =>
    prisma.job.findUnique({
      where: { id },
    }),
  );

  if (!job) {
    notFound();
  }

  const customers = await withDatabaseRetry((prisma) =>
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  );

  let recentFiles: ReturnType<typeof mapJobFileRecordToRow>[] = [];

  if (job.folderPath) {
    try {
      const files = await withDatabaseRetry((client) =>
        listJobFiles(client, job.id),
      );
      recentFiles = files.slice(0, 5).map((file) =>
        mapJobFileRecordToRow(file, {
          jobNumber: job.jobNumber,
          customerName: job.customerName,
          projectName: job.projectName,
        }),
      );
    } catch {
      recentFiles = [];
    }
  }

  return (
    <DashboardShell
      title={`Edit ${job.jobNumber}`}
      subtitle={`${job.projectName} — update job details.`}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href="/jobs"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Jobs
        </Link>

        <SectionCard
          title="Job Details"
          description="Job number and year cannot be changed. Required fields are marked with an asterisk."
        >
          <JobForm
            action={updateJob}
            customers={customers}
            defaultJobYear={job.year}
            submitLabel="Save Changes"
            cancelHref="/jobs"
            defaultValues={{
              id: job.id,
              jobNumber: job.jobNumber,
              jobYear: job.year,
              customerId: job.customerId ?? "",
              customerName: job.customerId ? "" : job.customerName,
              projectName: job.projectName,
              projectAddress: job.projectAddress ?? "",
              city: job.city ?? "",
              state: job.state ?? "",
              zip: job.zip ?? "",
              status: job.status,
              bidDate: formatJobDateInput(job.bidDate),
              awardedDate: formatJobDateInput(job.awardedDate),
              contactName: job.contactName ?? "",
              contactEmail: job.contactEmail ?? "",
              contactPhone: job.contactPhone ?? "",
              notes: job.notes ?? "",
            }}
          />
        </SectionCard>

        <JobFilesPreview
          jobId={job.id}
          folderPath={job.folderPath}
          recentFiles={recentFiles}
        />
      </div>
    </DashboardShell>
  );
}
