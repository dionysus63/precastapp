import { describe, expect, it } from "vitest";
import {
  JOBS_DEFAULT_TAB_VALUES,
  isJobsDefaultTab,
  jobsLandingTabParam,
  resolveJobsLandingTab,
} from "@/lib/jobs-default-tab";

describe("resolveJobsLandingTab", () => {
  it("opens the user's default tab on a bare /jobs", () => {
    expect(resolveJobsLandingTab("", "OPEN")).toBe("open");
    expect(resolveJobsLandingTab("", "MY_OPEN")).toBe("mine");
    expect(resolveJobsLandingTab("", "FAVORITES")).toBe("favorites");
  });

  it("honors an explicit tab whatever the default is", () => {
    expect(resolveJobsLandingTab("OPEN", "MY_OPEN")).toBe("open");
    expect(resolveJobsLandingTab("MINE", "OPEN")).toBe("mine");
    expect(resolveJobsLandingTab("FAVORITES", "OPEN")).toBe("favorites");
    expect(resolveJobsLandingTab("OPEN", "FAVORITES")).toBe("open");
  });

  it("is no landing tab for other tabs and single statuses", () => {
    for (const status of ["COMPLETE", "CLOSED", "ALL", "ACTIVE"]) {
      for (const defaultTab of JOBS_DEFAULT_TAB_VALUES) {
        expect(resolveJobsLandingTab(status, defaultTab)).toBeNull();
      }
    }
  });
});

describe("jobsLandingTabParam", () => {
  it("keeps the default tab on the bare URL and spells out the others", () => {
    expect(jobsLandingTabParam("open", "OPEN")).toBe("");
    expect(jobsLandingTabParam("mine", "OPEN")).toBe("MINE");
    expect(jobsLandingTabParam("favorites", "OPEN")).toBe("FAVORITES");
    expect(jobsLandingTabParam("open", "MY_OPEN")).toBe("OPEN");
    expect(jobsLandingTabParam("mine", "MY_OPEN")).toBe("");
    expect(jobsLandingTabParam("open", "FAVORITES")).toBe("OPEN");
    expect(jobsLandingTabParam("favorites", "FAVORITES")).toBe("");
  });

  it("round-trips through resolveJobsLandingTab", () => {
    for (const defaultTab of JOBS_DEFAULT_TAB_VALUES) {
      for (const tab of ["open", "mine", "favorites"] as const) {
        expect(
          resolveJobsLandingTab(
            jobsLandingTabParam(tab, defaultTab),
            defaultTab,
          ),
        ).toBe(tab);
      }
    }
  });
});

describe("isJobsDefaultTab", () => {
  it("accepts only the stored values", () => {
    expect(isJobsDefaultTab("OPEN")).toBe(true);
    expect(isJobsDefaultTab("MY_OPEN")).toBe(true);
    expect(isJobsDefaultTab("FAVORITES")).toBe(true);
    expect(isJobsDefaultTab("MINE")).toBe(false);
    expect(isJobsDefaultTab("")).toBe(false);
    expect(isJobsDefaultTab(null)).toBe(false);
  });
});
