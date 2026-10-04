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

import { BackButton } from "@/components/dashboard/back-button";
type EditJobPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditJobPage({ params }: EditJobPageProps) {
  const { id } = await params;

  // Independent queries — run in parallel.
  // The customer picker searches the server as you type; it only needs its
  // first page of options plus the job's current customer.
  const [job, firstCustomers] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.job.findUnique({
        where: { id },
        include: { customer: { select: { id: true, name: true } } },
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.customer.findMany({
        orderBy: { name: "asc" },
        take: 20,
        select: { id: true, name: true },
      }),
    ),
  ]);

  if (!job) {
    notFound();
  }

  const customers = job.customer
    ? [
        job.customer,
        ...firstCustomers.filter((customer) => customer.id !== job.customer!.id),
      ]
    : firstCustomers;

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
        <BackButton href="/jobs" label="Back to Jobs" />

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
