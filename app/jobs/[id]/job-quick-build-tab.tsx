import Link from "next/link";
import { AppPermission } from "@/app/generated/prisma/client";
import { OneOffAllSheetsButton } from "@/components/quotes/one-off/one-off-all-sheets-button";
import { OneOffDrillSheets } from "@/components/quotes/one-off/one-off-drill-sheets";
import { OneOffEditSheets } from "@/components/quotes/one-off/one-off-edit-sheets";
import { TabBar, TabLink } from "@/components/ui/tabs";
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
import { joinNames } from "@/lib/quotes/quote-from-sheets";
import {
  summarizeSheetsForQuote,
  type SheetsForQuoteSummary,
} from "@/lib/quotes/quote-from-sheets-load";
import {
  jobQuickBuildLinks,
  jobQuickBuildView,
  quickBuildPageLinks,
  quoteFromSheetsHref,
} from "@/lib/quotes/quick-build-links";

/** The Quick Build tab's own query string, as the job page received it. */
export type JobQuickBuildParams = {
  view?: string;
  draft?: string;
  sheets?: string;
};

/**
 * Job page → Quick Build: the same build screen as Quotes → Quick Build
 * (setup strip, sideways grid and live PDF) with the job already picked, so
 * new sheets land on this job. "Saved Sheets" flips to the edit grids for
 * the drill sheets the job already has, and is where the tab opens once the
 * job has any. From there "Create Quote" starts a quote from those sheets.
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
  const editing =
    jobQuickBuildView({
      view: params.view,
      draft: params.draft,
      sheetCount: job.sheetCount,
    }) === "edit";
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
  const [{ circularOptions, rectOptions }, drafts, quoteSummary] =
    await Promise.all([
      loadOneOffOptions(usedTemplateIds),
      loadOneOffDraftSummaries({ jobId }),
      editing && user && (await hasPermission(user, AppPermission.QUOTES_MANAGE))
        ? summarizeSheetsForQuote(jobId, sheetIds.length > 0 ? sheetIds : null)
        : null,
    ]);

  const header = (
    <TabBar
      label="Quick Build view"
      trailing={
        <>
          <span className="text-xs text-slate-500">
            {editing
              ? "Change cells on the saved drill sheets; only changed rows are saved."
              : `New drill sheets are created on ${job.jobNumber} without picking the job.`}
            {editing && drafts.length > 0 ? (
              <>
                {" "}
                <Link href={links.start} className="font-medium text-sky-600 hover:underline">
                  {drafts.length === 1
                    ? "1 draft saved for later"
                    : `${drafts.length} drafts saved for later`}
                </Link>
              </>
            ) : null}
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
            {quoteSummary ? (
              <CreateQuoteFromSheets
                href={quoteFromSheetsHref(jobId, sheetIds)}
                summary={quoteSummary}
              />
            ) : null}
            <Link
              href={editing ? quickBuildPageLinks.edit(jobId) : quickBuildPageLinks.start}
              className="text-xs font-medium text-sky-600 hover:underline"
            >
              Open full Quick Build page →
            </Link>
          </div>
        </>
      }
    >
      <TabLink href={links.start} active={!editing}>
        New Sheets
      </TabLink>
      {job.sheetCount > 0 ? (
        <TabLink href={links.edit(jobId)} active={editing} count={job.sheetCount}>
          Saved Sheets
        </TabLink>
      ) : null}
    </TabBar>
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

/**
 * Saved Sheets → "Create Quote": opens the New Quote form filled with the
 * saved structures and their castings. A sheet one of the job's quotes
 * already has is left out, so the same structure is not quoted twice.
 */
function CreateQuoteFromSheets({
  href,
  summary,
}: {
  href: string;
  summary: SheetsForQuoteSummary;
}) {
  const { quotableCount, leftOut } = summary;
  const quotes = new Map<string, { id: string; quoteNumber: string }>();
  for (const sheet of leftOut) {
    quotes.set(sheet.quote.id, sheet.quote);
  }
  const onQuotes = [...quotes.values()];

  if (quotableCount === 0) {
    if (onQuotes.length === 0) {
      return null;
    }
    return (
      <span className="text-xs text-slate-500">
        {leftOut.length === 1 ? "This sheet is" : "These sheets are"} already on quote{" "}
        {onQuotes.map((quote, index) => (
          <span key={quote.id}>
            {index > 0 ? ", " : ""}
            <Link
              href={`/quotes/${quote.id}`}
              className="font-semibold text-sky-600 hover:underline"
            >
              {quote.quoteNumber}
            </Link>
          </span>
        ))}
      </span>
    );
  }

  const title = [
    `Opens a new quote for this job with ${quotableCount === 1 ? "this structure" : `these ${quotableCount} structures`} and ${quotableCount === 1 ? "its casting" : "their castings"} already on it, priced from the price list. Nothing is saved until you save the quote.`,
    leftOut.length > 0
      ? `Left out, already on quote ${joinNames(onQuotes.map((quote) => quote.quoteNumber))}: ${joinNames(leftOut.map((sheet) => sheet.structureNumber))}.`
      : "",
    "Changes you haven't saved yet are not in the quote.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link
      href={href}
      title={title}
      className="rounded-lg btn-plain px-3 py-1.5 text-xs font-semibold"
    >
      {leftOut.length > 0
        ? `Create Quote (${quotableCount} not quoted yet)`
        : "Create Quote"}
    </Link>
  );
}
