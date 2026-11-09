// Links into Quick Build (the drill-sheet grid once called One-Off). The
// same screen lives on its own page under Quotes and on each job's Quick
// Build tab, so every link is built here from one base URL.
//
// Safe to import from both server and client modules.

export const QUICK_BUILD_PATH = "/quotes/quick-build";

export type QuickBuildQuery = {
  /** Resume a saved draft. */
  draft?: string | null;
  /** Edit a job's saved sheets (the standalone page needs the job id). */
  edit?: string | null;
  /** Only these sheets, comma-separated ids, in edit mode. */
  sheets?: string | null;
  /** Job tab only: "edit" shows the job's saved sheets instead of new rows. */
  view?: "edit" | null;
};

function withQuery(base: string, query: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }
  const search = params.toString();
  if (!search) {
    return base;
  }
  return `${base}${base.includes("?") ? "&" : "?"}${search}`;
}

/**
 * Where a Quick Build screen is mounted. Server components pass this plain
 * value to the client components, which build their links from it (functions
 * can't cross the server/client boundary).
 */
export type QuickBuildMount =
  | { kind: "page" }
  | { kind: "job"; jobId: string };

/** Where a Quick Build screen's own links go, given where it is mounted. */
export type QuickBuildLinks = {
  /** A fresh screen (new rows, no draft). */
  start: string;
  /** The same screen with that draft reopened. */
  draft: (draftId: string) => string;
  /** The job's saved sheets, optionally only the given ones. */
  edit: (jobId: string, sheetIds?: string[]) => string;
};

/** Links for the standalone Quotes → Quick Build page. */
export const quickBuildPageLinks: QuickBuildLinks = {
  start: QUICK_BUILD_PATH,
  draft: (draftId) => withQuery(QUICK_BUILD_PATH, { draft: draftId }),
  edit: (jobId, sheetIds) =>
    withQuery(QUICK_BUILD_PATH, {
      edit: jobId,
      sheets: sheetIds?.length ? sheetIds.join(",") : null,
    }),
};

/** Links for the Quick Build tab on a job's page. */
export function jobQuickBuildLinks(jobId: string): QuickBuildLinks {
  const base = `/jobs/${jobId}?tab=quick-build`;
  return {
    start: base,
    draft: (draftId) => withQuery(base, { draft: draftId }),
    edit: (_jobId, sheetIds) =>
      withQuery(base, {
        view: "edit",
        sheets: sheetIds?.length ? sheetIds.join(",") : null,
      }),
  };
}

/** The links for a mount point. */
export function quickBuildLinksFor(mount: QuickBuildMount): QuickBuildLinks {
  return mount.kind === "job"
    ? jobQuickBuildLinks(mount.jobId)
    : quickBuildPageLinks;
}
