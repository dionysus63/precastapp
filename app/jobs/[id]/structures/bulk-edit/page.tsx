import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { JobStructuresBulkEditClient } from "@/components/jobs/bulk-edit/job-structures-bulk-edit-client";
import {
  loadDrillSheetFormOptions,
  loadRectSheetFormOptions,
} from "@/lib/drill-sheet-options";
import { loadJobStructuresForBulkEdit } from "@/lib/job-structures-bulk-edit";
import { requirePermission } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";

type BulkEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function JobStructuresBulkEditPage({
  params,
}: BulkEditPageProps) {
  const { id } = await params;
  await requirePermission("STRUCTURES_MANAGE");

  const job = await withDatabaseRetry((client) =>
    client.job.findUnique({
      where: { id },
      select: { id: true, jobNumber: true, projectName: true },
    }),
  );
  if (!job) {
    notFound();
  }

  const [data, circularFormOptions, rectFormOptions] = await Promise.all([
    withDatabaseRetry((client) => loadJobStructuresForBulkEdit(client, id)),
    loadDrillSheetFormOptions(),
    loadRectSheetFormOptions(),
  ]);

  return (
    <DashboardShell
      title="Bulk Edit Structures"
      subtitle={`${job.jobNumber} — ${job.projectName}`}
    >
      <div className="mb-3">
        <Link
          href={`/jobs/${id}`}
          className="text-xs font-medium text-sky-600 hover:underline"
        >
          ← Back to job
        </Link>
      </div>
      <JobStructuresBulkEditClient
        jobId={id}
        data={data}
        circularOptions={{
          templates: circularFormOptions.templateOptions,
          castings: circularFormOptions.castingOptions,
          pipeOpeningSizes: circularFormOptions.pipeOpeningSizes,
          diameterConfigs: circularFormOptions.diameterConfigs,
        }}
        rectOptions={{
          templates: rectFormOptions.templateOptions,
          castings: rectFormOptions.castingOptions,
          openingSizes: rectFormOptions.openingSizes,
        }}
      />
    </DashboardShell>
  );
}
