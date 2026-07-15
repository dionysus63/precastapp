import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { JobForm } from "@/components/jobs/job-form";
import { createJob } from "../actions";
import { prisma } from "@/lib/prisma";

import { BackButton } from "@/components/dashboard/back-button";
export default async function NewJobPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const defaultJobYear = new Date().getFullYear();

  return (
    <DashboardShell
      title="New Job"
      subtitle="Create a new job record. A job number will be assigned automatically for the current year."
    >
      <div className="mx-auto max-w-3xl">
        <BackButton href="/jobs" label="Back to Jobs" />

        <div className="mt-4">
          <SectionCard
            title="Job Details"
            description="Required fields are marked with an asterisk."
          >
            <JobForm
              action={createJob}
              customers={customers}
              defaultJobYear={defaultJobYear}
            />
          </SectionCard>
        </div>
      </div>
    </DashboardShell>
  );
}
