/**
 * The Jobs list tab a user lands on when they click Jobs: every open job, or
 * only the open jobs they created. Each user picks their own (stored on
 * `User.defaultJobsTab`); "OPEN" is the default.
 */
export const JOBS_DEFAULT_TAB_VALUES = ["OPEN", "MY_OPEN"] as const;

export type JobsDefaultTabValue = (typeof JOBS_DEFAULT_TAB_VALUES)[number];

export const JOBS_DEFAULT_TAB_OPTIONS: ReadonlyArray<{
  value: JobsDefaultTabValue;
  label: string;
}> = [
  { value: "OPEN", label: "All open jobs" },
  { value: "MY_OPEN", label: "Only my open jobs" },
];

export function isJobsDefaultTab(value: unknown): value is JobsDefaultTabValue {
  return (
    typeof value === "string" &&
    (JOBS_DEFAULT_TAB_VALUES as readonly string[]).includes(value)
  );
}

/** `?status=` values that name the two open tabs explicitly. */
export const JOBS_OPEN_TAB_PARAM = "OPEN";
export const JOBS_MY_OPEN_TAB_PARAM = "MINE";

export type JobsOpenTab = "open" | "mine" | null;

/**
 * Which open tab a `/jobs` request shows. A bare `/jobs` (no status) follows
 * the user's default; `?status=OPEN` and `?status=MINE` always mean that tab.
 * Null when the status names something else (Complete, Closed, All, or a
 * single status).
 */
export function resolveJobsOpenTab(
  statusParam: string,
  defaultTab: JobsDefaultTabValue,
): JobsOpenTab {
  if (statusParam === JOBS_MY_OPEN_TAB_PARAM) {
    return "mine";
  }
  if (statusParam === JOBS_OPEN_TAB_PARAM) {
    return "open";
  }
  if (statusParam === "") {
    return defaultTab === "MY_OPEN" ? "mine" : "open";
  }
  return null;
}

/**
 * The `?status=` value a tab links to: the user's default tab is the bare
 * `/jobs` URL, the other one is spelled out.
 */
export function jobsOpenTabParam(
  tab: "open" | "mine",
  defaultTab: JobsDefaultTabValue,
): string {
  const isDefault = (tab === "mine") === (defaultTab === "MY_OPEN");
  if (isDefault) {
    return "";
  }
  return tab === "mine" ? JOBS_MY_OPEN_TAB_PARAM : JOBS_OPEN_TAB_PARAM;
}
