import { describe, expect, it } from "vitest";
import {
  jobQuickBuildLinks,
  jobQuickBuildView,
  quoteFromSheetsHref,
} from "@/lib/quotes/quick-build-links";
import {
  mapCircularSheetToWorkbookRow,
  mapRectSheetToWorkbookRow,
} from "@/lib/quotes/job-sheet-import";
import {
  castingLinesForSheets,
  joinNames,
  quoteFromSheetsNotes,
  splitSheetsForQuote,
  type SheetForQuote,
} from "@/lib/quotes/quote-from-sheets";
import type { QuoteFormProductOption } from "@/lib/quotes/types";

describe("jobQuickBuildView", () => {
  it("opens a job that has saved sheets on them", () => {
    expect(jobQuickBuildView({ sheetCount: 3 })).toBe("edit");
    expect(jobQuickBuildView({ view: "", draft: " ", sheetCount: 1 })).toBe("edit");
  });

  it("opens a job with no sheets on new rows", () => {
    expect(jobQuickBuildView({ sheetCount: 0 })).toBe("new");
  });

  it("lets the link's own view win either way", () => {
    expect(jobQuickBuildView({ view: "new", sheetCount: 3 })).toBe("new");
    expect(jobQuickBuildView({ view: "edit", sheetCount: 0 })).toBe("edit");
    expect(jobQuickBuildView({ view: "edit", draft: "d1", sheetCount: 3 })).toBe("edit");
  });

  it("reopens a saved draft in the grid for new rows", () => {
    expect(jobQuickBuildView({ draft: "d1", sheetCount: 3 })).toBe("new");
  });

  it("ignores a view it does not know", () => {
    expect(jobQuickBuildView({ view: "bogus", sheetCount: 2 })).toBe("edit");
  });
});

describe("Quick Build links on a job", () => {
  const links = jobQuickBuildLinks("job1");

  it("asks for new rows outright, since the bare tab can open on saved sheets", () => {
    expect(links.start).toBe("/jobs/job1?tab=quick-build&view=new");
    expect(links.draft("d1")).toBe("/jobs/job1?tab=quick-build&draft=d1");
    expect(links.edit("job1")).toBe("/jobs/job1?tab=quick-build&view=edit");
  });

  it("builds the New Quote link from the job's sheets", () => {
    expect(quoteFromSheetsHref("job1")).toBe("/quotes/new?jobId=job1&fromSheets=all");
    expect(quoteFromSheetsHref("job1", [])).toBe("/quotes/new?jobId=job1&fromSheets=all");
    expect(quoteFromSheetsHref("job1", ["a", "b"])).toBe(
      "/quotes/new?jobId=job1&fromSheets=a%2Cb",
    );
  });
});

function sheet(overrides: Partial<SheetForQuote> = {}): SheetForQuote {
  return {
    id: "s1",
    shape: "CIRCULAR",
    templateName: "4' MH",
    description: null,
    structureTemplateId: "tmpl",
    structureNumber: "MH-1",
    quantity: 1,
    storedPrice: 1000,
    weightLbs: null,
    calc: {
      rimElevation: 100,
      lowestInvertFeet: 92,
      insideDiameterFeet: 4,
      insideLengthFeet: null,
      insideWidthFeet: null,
      wallHeightAdjustInches: 0,
    },
    dimensions: null,
    openings: [],
    castings: [{ castingProductId: "frame", description: "Frame", quantity: 1 }],
    onQuote: null,
    ...overrides,
  };
}

function product(overrides: Partial<QuoteFormProductOption> = {}): QuoteFormProductOption {
  return {
    id: "frame",
    code: "FC-24",
    name: "24in Frame & Cover",
    description: "24in Frame & Cover, Heavy Duty",
    category: "Castings",
    subcategory: "",
    unit: "EA",
    unitPrice: 385,
    weightLb: 310,
    yards: 0,
    taxable: true,
    ...overrides,
  };
}

describe("castingLinesForSheets", () => {
  it("makes one line per casting with the count across the sheets", () => {
    const lines = castingLinesForSheets(
      [
        sheet({ id: "a", structureNumber: "MH-1" }),
        sheet({
          id: "b",
          structureNumber: "CB-1",
          castings: [{ castingProductId: "grate", description: "Grate", quantity: 1 }],
        }),
        sheet({ id: "c", structureNumber: "MH-2", quantity: 2 }),
      ],
      new Map([
        ["frame", product()],
        ["grate", product({ id: "grate", code: "GR-1", description: "Grate", unitPrice: 465.5, weightLb: 0 })],
      ]),
    );

    expect(lines).toHaveLength(2);
    // In the order the castings first appear.
    expect(lines[0]).toMatchObject({
      type: "STOCK_PRODUCT",
      item: "FC-24",
      description: "24in Frame & Cover, Heavy Duty",
      // One on MH-1, and one on each of the two MH-2s.
      qty: "3",
      unit: "EA",
      unitPrice: "385",
      weight: "310",
      productId: "frame",
    });
    expect(lines[1]).toMatchObject({ item: "GR-1", qty: "1", unitPrice: "465.5", weight: "" });
  });

  it("keeps a casting whose product is gone, at no price", () => {
    const lines = castingLinesForSheets(
      [
        sheet({
          castings: [{ castingProductId: null, description: "Old Frame", quantity: 1 }],
        }),
        sheet({
          id: "b",
          castings: [{ castingProductId: "missing", description: "Lost", quantity: 1 }],
        }),
      ],
      new Map(),
    );
    expect(lines.map((line) => [line.type, line.description, line.unitPrice])).toEqual([
      ["MISC", "Old Frame", "0.00"],
      ["MISC", "Lost", "0.00"],
    ]);
  });

  it("makes no line for a sheet without a casting", () => {
    expect(castingLinesForSheets([sheet({ castings: [] })], new Map())).toEqual([]);
  });
});

describe("sheets already on a quote", () => {
  const quote = { id: "q1", quoteNumber: "Q-26-0042" };
  const sheets = [
    sheet({ id: "a", structureNumber: "MH-1" }),
    sheet({ id: "b", structureNumber: "MH-2", onQuote: quote }),
    sheet({ id: "c", structureNumber: "MH-3", onQuote: quote }),
  ];

  it("are left out and named", () => {
    const { included, leftOut } = splitSheetsForQuote(sheets);
    expect(included.map((entry) => entry.structureNumber)).toEqual(["MH-1"]);
    expect(leftOut).toEqual([
      { structureNumber: "MH-2", quote },
      { structureNumber: "MH-3", quote },
    ]);
  });

  it("are spelled out above the quote form with any line that has no price", () => {
    const notes = quoteFromSheetsNotes(
      {
        lineItems: [],
        structureCount: 1,
        leftOut: splitSheetsForQuote(sheets).leftOut,
        unpriced: ["MH-1"],
      },
      "26-0042",
    );
    expect(notes.info).toBe(
      "Filled from 1 structure saved in Quick Build on 26-0042, with its casting below. Nothing is saved until you save this quote.",
    );
    expect(notes.warnings).toEqual([
      "No price was found for MH-1. That line is at $0.00: type the price in.",
      "Left out, already on quote Q-26-0042: MH-2 and MH-3.",
    ]);
  });
});

describe("joinNames", () => {
  it("reads as a sentence and stops listing past the limit", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B"])).toBe("A and B");
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
    expect(joinNames(["A", "B", "C", "D"], 3)).toBe("A, B and 2 more");
  });
});

describe("a stored sheet as a workbook row", () => {
  it("keeps a wall height moved by hand, which is part of the price", () => {
    const circular = mapCircularSheetToWorkbookRow(
      sheet({ calc: { ...sheet().calc!, wallHeightAdjustInches: -6 } }),
    );
    expect(circular.wallHeightAdjustInches).toBe(-6);
    expect(mapCircularSheetToWorkbookRow(sheet()).wallHeightAdjustInches).toBe(0);
  });

  it("keeps a rectangular sheet's wall height change and steps", () => {
    const rect = mapRectSheetToWorkbookRow(
      sheet({
        shape: "RECTANGULAR",
        calc: { ...sheet().calc!, wallHeightAdjustInches: 12 },
        dimensions: {
          insideLength: 4,
          insideWidth: 2.5,
          hasTopSlab: true,
          hasBaseSlab: true,
          baseAttached: true,
          topSlabOpeningLengthInches: null,
          topSlabOpeningWidthInches: null,
          topSlabOpeningSide: null,
          stepsPosition: "UP_MIDDLE",
        },
      }),
    );
    expect(rect.wallHeightAdjustInches).toBe(12);
    expect(rect.stepsPosition).toBe("UP_MIDDLE");
  });
});
