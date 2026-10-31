import "server-only";

import { withDatabaseRetry } from "@/lib/prisma";
import {
  countDraftRows,
  describeDraftJob,
  parseOneOffDraftState,
  type OneOffDraftSummary,
  type OneOffResumedDraft,
} from "@/lib/quotes/one-off-draft";
import { loadOneOffJobDetails } from "@/lib/quotes/one-off-job";

const JOB_LABEL_SELECT = {
  jobNumber: true,
  projectName: true,
  customerName: true,
} as const;

/** Every saved draft, newest save first, for the One-Off page's list. */
export async function loadOneOffDraftSummaries(): Promise<OneOffDraftSummary[]> {
  const drafts = await withDatabaseRetry((client) =>
    client.oneOffDraft.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        jobId: true,
        draftJson: true,
        savedBy: true,
        updatedAt: true,
        job: { select: JOB_LABEL_SELECT },
      },
    }),
  );

  return drafts.flatMap((draft) => {
    const state = parseOneOffDraftState(draft.draftJson);
    if (!state) {
      return [];
    }
    const wantsJob = state.job?.mode === "existing";
    return [
      {
        id: draft.id,
        name: draft.name,
        jobLabel: describeDraftJob(state.job, draft.job),
        jobMissing: wantsJob && draft.job == null,
        shapeChoice: state.shapeChoice,
        rowCount: countDraftRows(state),
        savedBy: draft.savedBy,
        savedAt: draft.updatedAt.toISOString(),
      },
    ];
  });
}

/**
 * One draft ready to resume. Its existing job is reloaded so the address and
 * taken structure numbers are current; a deleted job comes back as missing
 * and the page asks for a job again.
 */
export async function loadOneOffDraftForResume(
  draftId: string,
): Promise<OneOffResumedDraft | null> {
  const draft = await withDatabaseRetry((client) =>
    client.oneOffDraft.findUnique({
      where: { id: draftId },
      select: {
        id: true,
        name: true,
        jobId: true,
        draftJson: true,
        savedBy: true,
        updatedAt: true,
      },
    }),
  );
  if (!draft) {
    return null;
  }
  const state = parseOneOffDraftState(draft.draftJson);
  if (!state) {
    return null;
  }

  let job = null;
  let jobMissing = false;
  if (state.job?.mode === "existing") {
    // The stored jobId wins over the column: the column is nulled when the
    // job is deleted, and the state is what the user actually saved.
    job = await loadOneOffJobDetails(state.job.jobId);
    jobMissing = job == null;
  }

  return {
    id: draft.id,
    name: draft.name,
    savedBy: draft.savedBy,
    savedAt: draft.updatedAt.toISOString(),
    state,
    job,
    jobMissing,
  };
}
