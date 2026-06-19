import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import { JobForm } from "@/components/jobs/job-form";
import { createJob } from "../actions";
import { prisma } from "@/lib/prisma";

export default async function NewJobPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const defaultJobYear = new Date().getFullYear();

  return (
    <DashboardShell
      title="New Job"
      subtitle="Create a new job record and assign a job number for the selected year."
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href="/jobs"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to Jobs
        </Link>

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
