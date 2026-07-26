import { describe, expect, it } from "vitest";
import { translateToClientPath } from "@/lib/client-path-mapping";

const JOBS = { serverRoot: "C:\\PrecastJobs", clientRoot: "\\\\SERVER\\PrecastJobs" };
const STOCK = {
  serverRoot: "C:\\StockSubmittals",
  clientRoot: "\\\\SERVER\\StockSubmittals",
};

describe("translateToClientPath", () => {
  it("rewrites a path under a mapped root", () => {
    expect(
      translateToClientPath(
        "C:\\PrecastJobs\\2026\\26-007 - Holbrook Sewer Expansion\\01 Construction Plans\\Reduced 8167 SBidPlans.pdf",
        [JOBS],
      ),
    ).toBe(
      "\\\\SERVER\\PrecastJobs\\2026\\26-007 - Holbrook Sewer Expansion\\01 Construction Plans\\Reduced 8167 SBidPlans.pdf",
    );
  });

  it("rewrites the root itself", () => {
    expect(translateToClientPath("C:\\PrecastJobs", [JOBS])).toBe(
      "\\\\SERVER\\PrecastJobs",
    );
  });

  it("matches case-insensitively and ignores trailing separators", () => {
    expect(
      translateToClientPath("c:\\precastjobs\\2026", [
        { serverRoot: "C:\\PrecastJobs\\", clientRoot: "\\\\SERVER\\PrecastJobs\\" },
      ]),
    ).toBe("\\\\SERVER\\PrecastJobs\\2026");
  });

  it("does not match a sibling folder sharing the root as a prefix", () => {
    expect(translateToClientPath("C:\\PrecastJobsArchive\\2020", [JOBS])).toBe(
      "C:\\PrecastJobsArchive\\2020",
    );
  });

  it("returns the path unchanged when no mapping applies", () => {
    expect(translateToClientPath("D:\\Other\\file.pdf", [JOBS, STOCK])).toBe(
      "D:\\Other\\file.pdf",
    );
  });

  it("prefers the longest matching root", () => {
    expect(
      translateToClientPath("C:\\PrecastJobs\\2026\\job", [
        JOBS,
        {
          serverRoot: "C:\\PrecastJobs\\2026",
          clientRoot: "\\\\SERVER\\PrecastJobs2026",
        },
      ]),
    ).toBe("\\\\SERVER\\PrecastJobs2026\\job");
  });

  it("picks the right mapping per root", () => {
    expect(
      translateToClientPath("C:\\StockSubmittals\\MH-48\\sheet.pdf", [JOBS, STOCK]),
    ).toBe("\\\\SERVER\\StockSubmittals\\MH-48\\sheet.pdf");
  });
});
