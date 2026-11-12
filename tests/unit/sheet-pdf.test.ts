import { describe, expect, it } from "vitest";
import {
  sheetPdfCoverageHref,
  sheetPdfDownloadHref,
  sheetPdfDownloadName,
  sheetPdfFitsTemplate,
  sheetPdfKindLabel,
  sheetPdfSlabLabel,
} from "@/lib/sheet-pdf";
import { templateSheetPdfKind } from "@/lib/structure-template-payload";

const rect = (hasTopSlab: boolean, hasBaseSlab: boolean) =>
  ({ shape: "RECTANGULAR", hasTopSlab, hasBaseSlab }) as const;
const round = { shape: "CIRCULAR", hasTopSlab: false, hasBaseSlab: false } as const;

describe("which Sheet PDFs fit a template", () => {
  it("a rectangular sheet fits only templates with the slabs it is drawn for", () => {
    expect(sheetPdfFitsTemplate(rect(true, false), rect(true, false))).toBe(true);
    expect(sheetPdfFitsTemplate(rect(true, false), rect(true, true))).toBe(false);
    expect(sheetPdfFitsTemplate(rect(true, false), rect(false, false))).toBe(false);
    expect(sheetPdfFitsTemplate(rect(false, true), rect(true, false))).toBe(false);
  });

  it("a round sheet fits every round template, whatever its slab thicknesses", () => {
    expect(
      sheetPdfFitsTemplate(round, {
        shape: "CIRCULAR",
        hasTopSlab: true,
        hasBaseSlab: true,
      }),
    ).toBe(true);
  });

  it("never crosses shapes", () => {
    expect(sheetPdfFitsTemplate(round, rect(false, false))).toBe(false);
    expect(
      sheetPdfFitsTemplate(rect(true, true), {
        shape: "CIRCULAR",
        hasTopSlab: true,
        hasBaseSlab: true,
      }),
    ).toBe(false);
  });

  it("reads a template's slabs from its thicknesses (0 = no slab)", () => {
    expect(
      templateSheetPdfKind({
        shape: "RECTANGULAR",
        topSlabThicknessInches: 8,
        baseSlabThicknessInches: 0,
      }),
    ).toEqual(rect(true, false));
    expect(
      templateSheetPdfKind({
        shape: "RECTANGULAR",
        topSlabThicknessInches: "0.00",
        baseSlabThicknessInches: "6.00",
      }),
    ).toEqual(rect(false, true));
  });
});

describe("Sheet PDF wording", () => {
  it("names the slab combination", () => {
    expect(sheetPdfSlabLabel(true, true)).toBe("top slab + base");
    expect(sheetPdfSlabLabel(true, false)).toBe("top slab, no base");
    expect(sheetPdfSlabLabel(false, true)).toBe("no top slab + base");
    expect(sheetPdfSlabLabel(false, false)).toBe("no top slab, no base");
  });

  it("names the kind", () => {
    expect(sheetPdfKindLabel(round)).toBe("round");
    expect(sheetPdfKindLabel(rect(true, false))).toBe(
      "rectangular, top slab, no base",
    );
  });
});

describe("saving a Sheet PDF out of the app", () => {
  it("names the file after the Sheet PDF", () => {
    expect(sheetPdfDownloadName("CB Standard - Top Slab + Base")).toBe(
      "CB Standard - Top Slab + Base.pdf",
    );
  });

  it("drops characters a file name cannot hold", () => {
    expect(sheetPdfDownloadName('4x6 Box: 6"/8" walls?')).toBe(
      "4x6 Box- 6-8- walls.pdf",
    );
    expect(sheetPdfDownloadName("   ")).toBe("Sheet PDF.pdf");
  });

  it("links to the download and field check routes", () => {
    expect(sheetPdfDownloadHref("abc 123")).toBe(
      "/api/sheet-pdfs/abc%20123/download",
    );
    expect(sheetPdfCoverageHref("abc123")).toBe(
      "/api/sheet-pdfs/abc123/coverage",
    );
  });
});

describe("names of converted set slots", () => {
  it("names a slab variant after its family and slabs, as the migration does", async () => {
    const { rectSheetPdfSlotName } = await import("@/lib/sheet-pdf");
    expect(rectSheetPdfSlotName("CB Standard", true, true)).toBe(
      "CB Standard - Top Slab + Base",
    );
    expect(rectSheetPdfSlotName("CB Standard", true, false)).toBe(
      "CB Standard - Top Slab, No Base",
    );
    expect(rectSheetPdfSlotName(" CB Standard ", false, true)).toBe(
      "CB Standard - No Top Slab + Base",
    );
    expect(rectSheetPdfSlotName("CB Standard", false, false)).toBe(
      "CB Standard - No Top Slab, No Base",
    );
  });
});
