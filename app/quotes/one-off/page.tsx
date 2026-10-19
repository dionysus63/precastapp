import Link from "next/link";
import { AppPermission } from "@/app/generated/prisma/client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OneOffDrillSheets } from "@/components/quotes/one-off/one-off-drill-sheets";
import { OneOffEditSheets } from "@/components/quotes/one-off/one-off-edit-sheets";
import { requirePermission } from "@/lib/auth/session";
import {
  loadDrillSheetFormOptions,
  loadRectSheetFormOptions,
} from "@/lib/drill-sheet-options";
import { withDatabaseRetry } from "@/lib/prisma";
import { loadOneOffEditData } from "@/lib/quotes/one-off-edit";

type OneOffPageProps = {
  searchParams: Promise<{ edit?: string | string[]; sheets?: string | string[] }>;
};

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function OneOffDrillSheetsPage({
  searchParams,
}: OneOffPageProps) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const params = await searchParams;
  const editJobId = single(params.edit);

  // Sheets being edited on a since-retired template keep it available.
  const usedTemplateIds = editJobId
    ? (
        await withDatabaseRetry((client) =>
          client.jobStructure.findMany({
            where: { jobId: editJobId, structureTemplateId: { not: null } },
            select: { structureTemplateId: true },
            distinct: ["structureTemplateId"],
          }),
        )
      ).map((structure) => structure.structureTemplateId ?? "")
    : [];
  const [circular, rect] = await Promise.all([
    loadDrillSheetFormOptions(null, { includeTemplateIds: usedTemplateIds }),
    loadRectSheetFormOptions(),
  ]);
  const circularOptions = {
    templates: circular.templateOptions,
    castings: circular.castingOptions,
    pipeOpeningSizes: circular.pipeOpeningSizes,
    diameterConfigs: circular.diameterConfigs,
  };
  const rectOptions = {
    templates: rect.templateOptions,
    castings: rect.castingOptions,
    openingSizes: rect.openingSizes,
  };

  if (!editJobId) {
    return (
      <DashboardShell
        title="One-Off Drill Sheets"
        subtitle="Make a few drill sheets for a job without building a quote first."
      >
        <OneOffDrillSheets
          circularOptions={circularOptions}
          rectOptions={rectOptions}
        />
      </DashboardShell>
    );
  }

  const sheetIds = single(params.sheets)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const data = await loadOneOffEditData(
    editJobId,
    sheetIds,
    circularOptions.templates,
    rectOptions.templates,
  );

  return (
    <DashboardShell
      title="Edit One-Off Drill Sheets"
      subtitle={
        data
          ? `${data.job.jobNumber} — ${data.job.projectName} (${data.job.customerName})`
          : "Job not found"
      }
    >
      <div className="mb-3">
        <Link
          href="/quotes/one-off"
          className="text-xs font-medium text-sky-600 hover:underline"
        >
          ← New One-Off
        </Link>
      </div>
      {data ? (
        <OneOffEditSheets
          // Remount on a fresh load so the grids start from the saved sheets.
          key={`${editJobId}:${sheetIds.join(",")}`}
          data={data}
          circularOptions={circularOptions}
          rectOptions={rectOptions}
        />
      ) : (
        <p className="text-sm text-slate-600">
          That job was not found. It may have been deleted.
        </p>
      )}
    </DashboardShell>
  );
}
