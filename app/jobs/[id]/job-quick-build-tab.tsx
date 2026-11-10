import Link from "next/link";
import { AppPermission } from "@/app/generated/prisma/client";
import { OneOffAllSheetsButton } from "@/components/quotes/one-off/one-off-all-sheets-button";
import { OneOffDrillSheets } from "@/components/quotes/one-off/one-off-drill-sheets";
import { OneOffEditSheets } from "@/components/quotes/one-off/one-off-edit-sheets";
import { hasPermission, type AuthUser } from "@/lib/auth/permissions";
import {
  loadOneOffDraftForResume,
  loadOneOffDraftSummaries,
} from "@/lib/quotes/one-off-draft-load";
import { loadOneOffEditData } from "@/lib/quotes/one-off-edit";
import { loadOneOffJobDetails } from "@/lib/quotes/one-off-job";
import {
  draftTemplateIds,
  jobTemplateIds,
  loadOneOffOptions,
} from "@/lib/quotes/one-off-page-data";
import {
  jobQuickBuildLinks,
  quickBuildPageLinks,
} from "@/lib/quotes/quick-build-links";

/** The Quick Build tab's own query string, as the job page received it. */
export type JobQuickBuildParams = {
  view?: string;
  draft?: string;
  sheets?: string;
};

function ViewPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * Job page → Quick Build: the same build screen as Quotes → Quick Build
 * (setup strip, sideways grid and live PDF) with the job already picked, so
 * new sheets land on this job. "Saved Sheets" flips to the edit grids for
 * the drill sheets the job already has.
 */
export async function JobQuickBuildTab({
  jobId,
  params,
  user,
}: {
  jobId: string;
  params: JobQuickBuildParams;
  user: AuthUser | null;
}) {
  const canManage = user
    ? await hasPermission(user, AppPermission.STRUCTURES_MANAGE)
    : false;
  if (!canManage) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        Quick Build needs the Structures permission. Ask an admin to grant
        it under Settings → Users &amp; Access.
      </p>
    );
  }

  const job = await loadOneOffJobDetails(jobId);
  if (!job) {
    return (
      <p className="text-sm text-slate-600">
        That job was not found. It may have been deleted.
      </p>
    );
  }

  const links = jobQuickBuildLinks(jobId);
  const editing = params.view?.trim() === "edit";
  const draftId = editing ? "" : (params.draft?.trim() ?? "");
  const sheetIds = editing
    ? (params.sheets ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
  const resume = draftId ? await loadOneOffDraftForResume(draftId) : null;

  // Sheets being edited, or a draft's rows, on a since-retired template keep
  // it available in the pickers.
  const usedTemplateIds = editing
    ? await jobTemplateIds(jobId)
    : resume
      ? draftTemplateIds(resume.state)
      : [];
  const { circularOptions, rectOptions } =
    await loadOneOffOptions(usedTemplateIds);

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <ViewPill href={links.start} active={!editing}>
        New Sheets
      </ViewPill>
      {job.sheetCount > 0 ? (
        <ViewPill href={links.edit(jobId)} active={editing}>
          Saved Sheets ({job.sheetCount})
        </ViewPill>
      ) : null}
      <span className="text-xs text-slate-500">
        {editing
          ? "Change cells on the saved drill sheets; only changed rows are saved."
          : `New drill sheets are created on ${job.jobNumber} without picking the job.`}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        {editing ? (
          <OneOffAllSheetsButton
            jobId={jobId}
            jobNumber={job.jobNumber}
            projectName={job.projectName}
            sheetCount={sheetIds.length > 0 ? sheetIds.length : job.sheetCount}
            structureIds={sheetIds}
            unsavedNote
          />
        ) : null}
        <Link
          href={editing ? quickBuildPageLinks.edit(jobId) : quickBuildPageLinks.start}
          className="text-xs font-medium text-sky-600 hover:underline"
        >
          Open full Quick Build page →
        </Link>
      </div>
    </div>
  );

  if (editing) {
    const data = await loadOneOffEditData(
      jobId,
      sheetIds,
      circularOptions.templates,
      rectOptions.templates,
      rectOptions.openingSizes,
    );
    return (
      <div className="space-y-4">
        {header}
        {sheetIds.length > 0 ? (
          <p className="text-xs text-slate-500">
            Showing only the sheets just created.{" "}
            <Link href={links.edit(jobId)} className="font-semibold text-sky-600 hover:underline">
              Show every saved sheet
            </Link>
          </p>
        ) : null}
        {data ? (
          <OneOffEditSheets
            // Remount on a fresh load so the grids start from the saved sheets.
            key={`${jobId}:${sheetIds.join(",")}`}
            data={data}
            circularOptions={circularOptions}
            rectOptions={rectOptions}
          />
        ) : (
          <p className="text-sm text-slate-600">
            That job was not found. It may have been deleted.
          </p>
        )}
      </div>
    );
  }

  const drafts = await loadOneOffDraftSummaries({ jobId });
  return (
    <div className="space-y-4">
      {header}
      {draftId && !resume ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          That saved draft was not found. It may have been deleted, or its
          sheets were already created.{" "}
          <Link href={links.start} className="font-semibold underline">
            Start new sheets
          </Link>
        </div>
      ) : null}
      {resume ? (
        <p className="text-xs text-slate-500">
          Picking up the saved draft &ldquo;{resume.name}&rdquo;. Save again
          any time, or create the sheets when every row is ready.
        </p>
      ) : null}
      <OneOffDrillSheets
        // Remount when switching between drafts so the grids reload.
        key={resume?.id ?? "new"}
        circularOptions={circularOptions}
        rectOptions={rectOptions}
        drafts={drafts}
        resume={resume}
        mount={{ kind: "job", jobId }}
        fixedJob={job}
      />
    </div>
  );
}
