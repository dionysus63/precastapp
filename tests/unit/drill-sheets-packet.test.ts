import { describe, expect, it } from "vitest";
import {
  drillSheetsPacketFileName,
  drillSheetsPacketHref,
} from "@/lib/drill-sheets-packet";

describe("drillSheetsPacketFileName", () => {
  it("names the file after the job number and project", () => {
    expect(drillSheetsPacketFileName("24-105", "Main St Sewer")).toBe(
      "Drill Sheets - 24-105 - Main St Sewer.pdf",
    );
  });

  it("leaves out a blank project name", () => {
    expect(drillSheetsPacketFileName("24-105", "  ")).toBe(
      "Drill Sheets - 24-105.pdf",
    );
    expect(drillSheetsPacketFileName("24-105", null)).toBe(
      "Drill Sheets - 24-105.pdf",
    );
  });

  it("replaces characters Windows won't allow in a file name", () => {
    expect(
      drillSheetsPacketFileName("J/12", 'Route 25A: Sewer "Phase 2"'),
    ).toBe("Drill Sheets - J-12 - Route 25A- Sewer -Phase 2.pdf");
    expect(drillSheetsPacketFileName("24-105", "<east>\nlot")).toBe(
      "Drill Sheets - 24-105 - east-lot.pdf",
    );
  });

  it("keeps a very long project name to a sensible length", () => {
    const name = drillSheetsPacketFileName("24-105", "A".repeat(300));
    expect(name.length).toBeLessThanOrEqual(120);
    expect(name.endsWith(".pdf")).toBe(true);
  });
});

describe("drillSheetsPacketHref", () => {
  it("serves every sheet on the job when no structures are named", () => {
    expect(drillSheetsPacketHref("job1")).toBe("/api/jobs/job1/drill-sheets");
    expect(drillSheetsPacketHref("job1", { structureIds: [] })).toBe(
      "/api/jobs/job1/drill-sheets",
    );
  });

  it("limits the file to the named structures and can ask for a download", () => {
    expect(
      drillSheetsPacketHref("job1", {
        structureIds: ["a", "b"],
        download: true,
      }),
    ).toBe("/api/jobs/job1/drill-sheets?structureIds=a,b&download=1");
    expect(drillSheetsPacketHref("job1", { download: true })).toBe(
      "/api/jobs/job1/drill-sheets?download=1",
    );
  });
});
