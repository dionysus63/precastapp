/**
 * The Jobs list tab a user lands on when they click Jobs: every open job,
 * only the open jobs they created, or the jobs they starred. Each user picks
 * their own (stored on `User.defaultJobsTab`); "OPEN" is the default.
 */
export const JOBS_DEFAULT_TAB_VALUES = ["OPEN", "MY_OPEN", "FAVORITES"] as const;

export type JobsDefaultTabValue = (typeof JOBS_DEFAULT_TAB_VALUES)[number];

export const JOBS_DEFAULT_TAB_OPTIONS: ReadonlyArray<{
  value: JobsDefaultTabValue;
  label: string;
}> = [
  { value: "OPEN", label: "All open jobs" },
  { value: "MY_OPEN", label: "Only my open jobs" },
  { value: "FAVORITES", label: "My favorite jobs" },
];

export function isJobsDefaultTab(value: unknown): value is JobsDefaultTabValue {
  return (
    typeof value === "string" &&
    (JOBS_DEFAULT_TAB_VALUES as readonly string[]).includes(value)
  );
}

/** The tabs a user can land on: Open, My Open and Favorites. */
export type JobsLandingTab = "open" | "mine" | "favorites";

const LANDING_TAB_BY_DEFAULT: Record<JobsDefaultTabValue, JobsLandingTab> = {
  OPEN: "open",
  MY_OPEN: "mine",
  FAVORITES: "favorites",
};

/** `?status=` values that name each landing tab explicitly. */
const LANDING_TAB_PARAMS: Record<JobsLandingTab, string> = {
  open: "OPEN",
  mine: "MINE",
  favorites: "FAVORITES",
};

/**
 * Which landing tab a `/jobs` request shows. A bare `/jobs` (no status)
 * follows the user's default; `?status=OPEN`, `?status=MINE` and
 * `?status=FAVORITES` always mean that tab. Null when the status names
 * something else (Complete, Closed, All, or a single status).
 */
export function resolveJobsLandingTab(
  statusParam: string,
  defaultTab: JobsDefaultTabValue,
): JobsLandingTab | null {
  if (statusParam === "") {
    return LANDING_TAB_BY_DEFAULT[defaultTab];
  }
  const explicit = (
    Object.keys(LANDING_TAB_PARAMS) as JobsLandingTab[]
  ).find((tab) => LANDING_TAB_PARAMS[tab] === statusParam);
  return explicit ?? null;
}

/**
 * The `?status=` value a tab links to: the user's default tab is the bare
 * `/jobs` URL, the others are spelled out.
 */
export function jobsLandingTabParam(
  tab: JobsLandingTab,
  defaultTab: JobsDefaultTabValue,
): string {
  return LANDING_TAB_BY_DEFAULT[defaultTab] === tab
    ? ""
    : LANDING_TAB_PARAMS[tab];
}
