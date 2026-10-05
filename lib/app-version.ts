/**
 * What to do when the server's build id (GET /api/build-id) is compared with
 * the one this page started on. "development" (next dev) never triggers.
 */
export type VersionCheckStep = "none" | "reload" | "warn";

export function versionCheckStep(
  baseline: string | null,
  current: string | null,
  hasUnsavedChanges: boolean,
): VersionCheckStep {
  if (!baseline || !current || baseline === current) {
    return "none";
  }
  if (baseline === "development" || current === "development") {
    return "none";
  }
  // Reloading quietly is safe only when nothing typed would be lost.
  return hasUnsavedChanges ? "warn" : "reload";
}

/** Response header Next sets when a page calls a server action it no longer has. */
export const ACTION_NOT_FOUND_HEADER = "x-nextjs-action-not-found";
