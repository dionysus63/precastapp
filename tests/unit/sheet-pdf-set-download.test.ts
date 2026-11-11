import { describe, expect, it } from "vitest";
import {
  rectSheetVariantFileLabel,
  sheetPdfSetFileDownloadHref,
  sheetPdfSetFileDownloadName,
} from "@/lib/sheet-pdf-set-download";

describe("sheetPdfSetFileDownloadName", () => {
  it("names a rectangular set's file after the set and its slab slot", () => {
    expect(
      sheetPdfSetFileDownloadName("CB Standard", "RECTANGULAR", {
        hasTopSlab: true,
        hasBaseSlab: true,
      }),
    ).toBe("CB Standard - Top Slab + Base Slab.pdf");
    expect(
      sheetPdfSetFileDownloadName("CB Standard", "RECTANGULAR", {
        hasTopSlab: false,
        hasBaseSlab: false,
      }),
    ).toBe("CB Standard - No Top Slab + No Base.pdf");
  });

  it("gives each of the four slab slots its own name", () => {
    const names = [true, false].flatMap((hasTopSlab) =>
      [true, false].map((hasBaseSlab) =>
        rectSheetVariantFileLabel(hasTopSlab, hasBaseSlab),
      ),
    );
    expect(new Set(names).size).toBe(4);
  });

  it("names a circular set's single sheet after the set alone", () => {
    expect(
      sheetPdfSetFileDownloadName("Manhole Standard", "CIRCULAR", {
        hasTopSlab: false,
        hasBaseSlab: false,
      }),
    ).toBe("Manhole Standard.pdf");
  });

  it("replaces characters Windows won't allow in a file name", () => {
    expect(
      sheetPdfSetFileDownloadName('4x4 / 5x5: "NYS"', "CIRCULAR", {
        hasTopSlab: false,
        hasBaseSlab: false,
      }),
    ).toBe("4x4 - 5x5- -NYS.pdf");
  });

  it("falls back to a plain name when the set name is blank", () => {
    expect(
      sheetPdfSetFileDownloadName("  ", "CIRCULAR", {
        hasTopSlab: false,
        hasBaseSlab: false,
      }),
    ).toBe("Sheet PDF Set.pdf");
  });
});

describe("sheetPdfSetFileDownloadHref", () => {
  it("points at the slot's download route", () => {
    expect(sheetPdfSetFileDownloadHref("abc123")).toBe(
      "/api/rect-pdf-set-files/abc123/download",
    );
  });
});
