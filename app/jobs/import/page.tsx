import { AppPermission } from "@/app/generated/prisma/client";
import { BackButton } from "@/components/dashboard/back-button";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ImportJobWizard } from "@/components/jobs/import/import-job-wizard";
import { getDefaultTaxRate } from "@/lib/app-settings";
import { requirePermission } from "@/lib/auth/session";

export default async function ImportExistingJobPage() {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const defaultTaxRate = await getDefaultTaxRate();

  return (
    <DashboardShell
      title="Import Existing Job"
      subtitle="Bring in a job that was quoted and submitted outside the app, with its PDFs, in one pass."
    >
      <BackButton href="/jobs" label="Back to Jobs" />
      <div className="mt-4">
        <ImportJobWizard defaultTaxRate={defaultTaxRate} />
      </div>
    </DashboardShell>
  );
}
