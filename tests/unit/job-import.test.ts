import { describe, expect, it } from "vitest";
import {
  assignPagesInOrder,
  autoMatchFiles,
  formatPageList,
  matchFileToStructure,
  parseMoneyInput,
  parsePageList,
  statusDateFields,
  sumImportRows,
  type ImportRow,
  type ImportStructureRow,
} from "@/lib/job-import";

function structure(structureNumber: string, docs: ImportStructureRow["docs"] = {}): ImportStructureRow {
  return {
    kind: "STRUCTURE",
    key: structureNumber,
    structureNumber,
    description: "",
    quantity: "1",
    unitPrice: "",
    weightLbs: "",
    status: "APPROVED",
    docs,
  };
}

describe("matchFileToStructure", () => {
  const numbers = ["MH-1", "MH-10", "DMH-1", "CB-3", "HW-1"];

  it("forgives the separator between letters and number", () => {
    expect(matchFileToStructure("MH-1.pdf", numbers)).toBe("MH-1");
    expect(matchFileToStructure("MH 1 submittal.pdf", numbers)).toBe("MH-1");
    expect(matchFileToStructure("mh_1-approved.pdf", numbers)).toBe("MH-1");
    expect(matchFileToStructure("CB3.pdf", numbers)).toBe("CB-3");
  });

  it("doesn't let MH-1 claim MH-10 or DMH-1", () => {
    expect(matchFileToStructure("MH-10.pdf", numbers)).toBe("MH-10");
    expect(matchFileToStructure("DMH-1 sheet.pdf", numbers)).toBe("DMH-1");
  });

  it("returns null when nothing matches", () => {
    expect(matchFileToStructure("Outfall headwall.pdf", numbers)).toBeNull();
  });
});

describe("page lists", () => {
  it("formats runs", () => {
    expect(formatPageList([3, 1, 2, 5, 7, 8])).toBe("1–3, 5, 7–8");
    expect(formatPageList([4])).toBe("4");
  });

  it("parses ranges and rejects pages past the end", () => {
    expect(parsePageList("1-3, 5", 6)).toEqual([1, 2, 3, 5]);
    expect(parsePageList("2–3", 6)).toEqual([2, 3]);
    expect(parsePageList("7", 6)).toBeNull();
    expect(parsePageList("abc", 6)).toBeNull();
    expect(parsePageList("", 6)).toBeNull();
  });
});

describe("assignPagesInOrder", () => {
  it("splits evenly when the pages divide", () => {
    expect(assignPagesInOrder(6, 3)).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  it("gives one page each otherwise", () => {
    expect(assignPagesInOrder(5, 3)).toEqual([[1], [2], [3]]);
    expect(assignPagesInOrder(2, 3)).toEqual([[1], [2], []]);
  });
});

describe("autoMatchFiles", () => {
  it("attaches unclaimed separate files by name without touching hand-picked ones", () => {
    const rows: ImportRow[] = [
      structure("MH-1"),
      structure("CB-3", { SUBMITTAL: { fileKey: "picked", pages: null } }),
    ];
    const next = autoMatchFiles(rows, [
      { key: "a", kind: "SUBMITTAL", name: "MH-1 submittal.pdf", combined: false },
      { key: "b", kind: "SUBMITTAL", name: "CB-3.pdf", combined: false },
      { key: "c", kind: "DRILL_SHEET", name: "All sheets.pdf", combined: true },
    ]);
    expect((next[0] as ImportStructureRow).docs.SUBMITTAL).toEqual({ fileKey: "a", pages: null });
    expect((next[1] as ImportStructureRow).docs.SUBMITTAL).toEqual({ fileKey: "picked", pages: null });
    expect((next[0] as ImportStructureRow).docs.DRILL_SHEET).toBeUndefined();
  });
});

describe("money and dates", () => {
  it("reads typed prices and sums rows to the cent", () => {
    expect(parseMoneyInput("$1,234.50")).toBe(1234.5);
    expect(parseMoneyInput("")).toBeNull();
    const rows: ImportRow[] = [
      { ...structure("MH-1"), quantity: "2", unitPrice: "0.10" },
      { ...structure("MH-2"), quantity: "1", unitPrice: "0.20" },
    ];
    expect(sumImportRows(rows)).toBe(0.4);
  });

  it("stamps every date up to the status reached", () => {
    expect(statusDateFields("NOT_SUBMITTED")).toEqual([]);
    expect(statusDateFields("APPROVED")).toEqual(["submittedDate", "approvedDate"]);
    expect(statusDateFields("MADE")).toEqual([
      "submittedDate",
      "approvedDate",
      "productionDate",
      "madeDate",
    ]);
  });
});
