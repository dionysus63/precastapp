import Link from "next/link";
import { AppPermission } from "@/app/generated/prisma/client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OneOffDrillSheets } from "@/components/quotes/one-off/one-off-drill-sheets";
import { OneOffEditSheets } from "@/components/quotes/one-off/one-off-edit-sheets";
import { requirePermission } from "@/lib/auth/session";
import {
  loadOneOffDraftForResume,
  loadOneOffDraftSummaries,
} from "@/lib/quotes/one-off-draft-load";
import { loadOneOffEditData } from "@/lib/quotes/one-off-edit";
import {
  draftTemplateIds,
  jobTemplateIds,
  loadOneOffOptions,
} from "@/lib/quotes/one-off-page-data";
import { quickBuildPageLinks } from "@/lib/quotes/quick-build-links";

type QuickBuildPageProps = {
  searchParams: Promise<{
    edit?: string | string[];
    sheets?: string | string[];
    draft?: string | string[];
  }>;
};

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function QuickBuildPage({
  searchParams,
}: QuickBuildPageProps) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const params = await searchParams;
  const editJobId = single(params.edit);
  const draftId = editJobId ? "" : single(params.draft);
  const resume = draftId ? await loadOneOffDraftForResume(draftId) : null;

  // Sheets being edited, or a draft's rows, on a since-retired template keep
  // it available.
  const usedTemplateIds = editJobId
    ? await jobTemplateIds(editJobId)
    : resume
      ? draftTemplateIds(resume.state)
      : [];
  const { circularOptions, rectOptions } =
    await loadOneOffOptions(usedTemplateIds);

  if (!editJobId) {
    const drafts = await loadOneOffDraftSummaries();
    return (
      <DashboardShell
        title={resume ? `Quick Build — ${resume.name}` : "Quick Build"}
        subtitle={
          resume
            ? "Picking up a saved Quick Build. Save again any time, or create the sheets when every row is ready."
            : "Make a few drill sheets for a job without building a quote first."
        }
      >
        {draftId && !resume ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            That saved draft was not found. It may have been deleted, or its
            sheets were already created.{" "}
            <Link href={quickBuildPageLinks.start} className="font-semibold underline">
              Start a new Quick Build
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
          mount={{ kind: "page" }}
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
      title="Quick Build — Edit Sheets"
      subtitle={
        data
          ? `${data.job.jobNumber} — ${data.job.projectName} (${data.job.customerName})`
          : "Job not found"
      }
    >
      <div className="mb-3 flex flex-wrap gap-4">
        <Link
          href={quickBuildPageLinks.start}
          className="text-xs font-medium text-sky-600 hover:underline"
        >
          ← New Quick Build
        </Link>
        {data ? (
          <Link
            href={`/jobs/${data.job.id}?tab=quick-build`}
            className="text-xs font-medium text-sky-600 hover:underline"
          >
            Open on the job page →
          </Link>
        ) : null}
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
