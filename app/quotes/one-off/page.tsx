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
import type { OneOffDraftState } from "@/lib/quotes/one-off-draft";
import {
  loadOneOffDraftForResume,
  loadOneOffDraftSummaries,
} from "@/lib/quotes/one-off-draft-load";
import { loadOneOffEditData } from "@/lib/quotes/one-off-edit";

type OneOffPageProps = {
  searchParams: Promise<{
    edit?: string | string[];
    sheets?: string | string[];
    draft?: string | string[];
  }>;
};

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Circular template ids a draft's setup and rows refer to. */
function draftTemplateIds(state: OneOffDraftState): string[] {
  const ids = new Set<string>();
  if (state.circular.setup.templateId) {
    ids.add(state.circular.setup.templateId);
  }
  for (const row of state.circular.rows ?? []) {
    if (row.templateId) {
      ids.add(row.templateId);
    }
  }
  return [...ids];
}

export default async function OneOffDrillSheetsPage({
  searchParams,
}: OneOffPageProps) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const params = await searchParams;
  const editJobId = single(params.edit);
  const draftId = editJobId ? "" : single(params.draft);
  const resume = draftId ? await loadOneOffDraftForResume(draftId) : null;

  // Sheets being edited, or a draft's rows, on a since-retired template keep
  // it available.
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
    : resume
      ? draftTemplateIds(resume.state)
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
    const drafts = await loadOneOffDraftSummaries();
    return (
      <DashboardShell
        title={resume ? `One-Off Drill Sheets — ${resume.name}` : "One-Off Drill Sheets"}
        subtitle={
          resume
            ? "Picking up a saved One-Off. Save again any time, or create the sheets when every row is ready."
            : "Make a few drill sheets for a job without building a quote first."
        }
      >
        {draftId && !resume ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            That saved draft was not found. It may have been deleted, or its
            sheets were already created.{" "}
            <Link href="/quotes/one-off" className="font-semibold underline">
              Start a new One-Off
            </Link>
          </div>
        ) : null}
        <OneOffDrillSheets
          // Remount when switching between drafts so the grids reload.
          key={resume?.id ?? "new"}
          circularOptions={circularOptions}
          rectOptions={rectOptions}
          drafts={drafts}
          resume={resume}
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
