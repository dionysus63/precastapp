import { describe, expect, it } from "vitest";
import {
  isJobsDefaultTab,
  jobsOpenTabParam,
  resolveJobsOpenTab,
} from "@/lib/jobs-default-tab";

describe("resolveJobsOpenTab", () => {
  it("opens the user's default tab on a bare /jobs", () => {
    expect(resolveJobsOpenTab("", "OPEN")).toBe("open");
    expect(resolveJobsOpenTab("", "MY_OPEN")).toBe("mine");
  });

  it("honors an explicit tab whatever the default is", () => {
    expect(resolveJobsOpenTab("OPEN", "MY_OPEN")).toBe("open");
    expect(resolveJobsOpenTab("MINE", "OPEN")).toBe("mine");
  });

  it("is neither open tab for other tabs and single statuses", () => {
    for (const status of ["COMPLETE", "CLOSED", "ALL", "ACTIVE"]) {
      expect(resolveJobsOpenTab(status, "OPEN")).toBeNull();
      expect(resolveJobsOpenTab(status, "MY_OPEN")).toBeNull();
    }
  });
});

describe("jobsOpenTabParam", () => {
  it("keeps the default tab on the bare URL and spells out the other", () => {
    expect(jobsOpenTabParam("open", "OPEN")).toBe("");
    expect(jobsOpenTabParam("mine", "OPEN")).toBe("MINE");
    expect(jobsOpenTabParam("open", "MY_OPEN")).toBe("OPEN");
    expect(jobsOpenTabParam("mine", "MY_OPEN")).toBe("");
  });

  it("round-trips through resolveJobsOpenTab", () => {
    for (const defaultTab of ["OPEN", "MY_OPEN"] as const) {
      for (const tab of ["open", "mine"] as const) {
        expect(
          resolveJobsOpenTab(jobsOpenTabParam(tab, defaultTab), defaultTab),
        ).toBe(tab);
      }
    }
  });
});

describe("isJobsDefaultTab", () => {
  it("accepts only the two stored values", () => {
    expect(isJobsDefaultTab("OPEN")).toBe(true);
    expect(isJobsDefaultTab("MY_OPEN")).toBe(true);
    expect(isJobsDefaultTab("MINE")).toBe(false);
    expect(isJobsDefaultTab("")).toBe(false);
    expect(isJobsDefaultTab(null)).toBe(false);
  });
});
