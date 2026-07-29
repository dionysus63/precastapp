import { describe, expect, it } from "vitest";
import type { PDFFont } from "pdf-lib";
import { paginateQuoteLineItems } from "@/lib/quote-pdf-line-items";

// Width model: ~5pt per character at 9pt — enough to force realistic
// two-line wrapping in the 255pt description column.
const mockFont = {
  widthOfTextAtSize: (text: string, size: number) =>
    text.length * (size * 0.55),
} as unknown as PDFFont;

/** A typical structure line: description wraps to two lines. */
function structureRow(index: number) {
  return {
    item: `SMH-${index}`,
    qty: "1",
    description:
      '48" SCDPW MH — Rim 101.14\' / Inv 80.62\' — 18.5\' wall — Pipes: 2×10" DR-18',
    unitPrice: "$2,865.50",
    total: "$2,865.50",
  };
}

describe("paginateQuoteLineItems", () => {
  it("keeps a short quote on a single page", () => {
    const pages = paginateQuoteLineItems(
      Array.from({ length: 5 }, (_, i) => structureRow(i)),
      mockFont,
    );
    expect(pages).toHaveLength(1);
    expect(pages[0].isLastPage).toBe(true);
    expect(pages[0].items).toHaveLength(5);
  });

  it("fills earlier pages full; the remainder lands on the totals page", () => {
    // 26 two-line rows (the Holbrook quote shape): page 1 packs the full 15
    // a continuation holds, the remaining 11 fit with the totals — 2 pages.
    const items = Array.from({ length: 26 }, (_, i) => structureRow(i));
    const pages = paginateQuoteLineItems(items, mockFont);

    expect(pages).toHaveLength(2);
    expect(pages[0].isLastPage).toBe(false);
    expect(pages[0].items).toHaveLength(15);
    expect(pages[1].isLastPage).toBe(true);
    expect(pages[1].items).toHaveLength(11);
  });

  it("never pulls rows off an earlier page to fatten the last one", () => {
    // 29 rows: page 1 fills (15); the remaining 14 exceed the totals page's
    // capacity (12), so page 2 fills next — holding one row back so the
    // totals page never prints without a line item above it.
    const items = Array.from({ length: 29 }, (_, i) => structureRow(i));
    const pages = paginateQuoteLineItems(items, mockFont);

    expect(pages.map((page) => page.items.length)).toEqual([15, 13, 1]);
    expect(pages[1].isLastPage).toBe(false);
    expect(pages[2].isLastPage).toBe(true);
  });

  it("forces a new page at a PAGE_BREAK marker", () => {
    const items = [
      ...Array.from({ length: 3 }, (_, i) => structureRow(i)),
      { item: "", qty: "", description: "", unitPrice: "", total: "", isPageBreak: true },
      ...Array.from({ length: 3 }, (_, i) => structureRow(10 + i)),
    ];
    const pages = paginateQuoteLineItems(items, mockFont);

    // Without the break these 6 rows fit one page; the break splits them.
    expect(pages).toHaveLength(2);
    expect(pages[0].isLastPage).toBe(false);
    expect(pages[0].items).toHaveLength(3);
    expect(pages[1].isLastPage).toBe(true);
    expect(pages[1].items).toHaveLength(3);
    expect(pages.flatMap((page) => page.items).some((item) => item.isPageBreak)).toBe(
      false,
    );
  });

  it("packs oversized segments before a break onto full continuation pages", () => {
    const items = [
      ...Array.from({ length: 20 }, (_, i) => structureRow(i)),
      { item: "", qty: "", description: "", unitPrice: "", total: "", isPageBreak: true },
      ...Array.from({ length: 5 }, (_, i) => structureRow(30 + i)),
    ];
    const pages = paginateQuoteLineItems(items, mockFont);

    expect(pages.map((page) => page.items.length)).toEqual([15, 5, 5]);
    expect(pages[2].isLastPage).toBe(true);
  });

  it("ignores leading and doubled page breaks", () => {
    const breakRow = {
      item: "",
      qty: "",
      description: "",
      unitPrice: "",
      total: "",
      isPageBreak: true,
    };
    const pages = paginateQuoteLineItems(
      [breakRow, structureRow(1), breakRow, breakRow, structureRow(2)],
      mockFont,
    );
    expect(pages).toHaveLength(2);
    expect(pages[0].items).toHaveLength(1);
    expect(pages[1].items).toHaveLength(1);
    expect(pages[1].isLastPage).toBe(true);
  });

  it("a trailing page break leaves the totals page without items", () => {
    const breakRow = {
      item: "",
      qty: "",
      description: "",
      unitPrice: "",
      total: "",
      isPageBreak: true,
    };
    const pages = paginateQuoteLineItems(
      [structureRow(1), structureRow(2), breakRow],
      mockFont,
    );
    expect(pages).toHaveLength(2);
    expect(pages[0].isLastPage).toBe(false);
    expect(pages[0].items).toHaveLength(2);
    expect(pages[1].items).toHaveLength(0);
    expect(pages[1].isLastPage).toBe(true);
  });

  it("still paginates very long quotes without losing rows", () => {
    const items = Array.from({ length: 100 }, (_, i) => structureRow(i));
    const pages = paginateQuoteLineItems(items, mockFont);
    const totalRows = pages.reduce((sum, page) => sum + page.items.length, 0);
    expect(totalRows).toBe(100);
    expect(pages[pages.length - 1].isLastPage).toBe(true);
    expect(
      pages.slice(0, -1).every((page) => !page.isLastPage),
    ).toBe(true);
    // Every continuation page except possibly the one before the totals page
    // is packed full.
    expect(
      pages.slice(0, -2).every((page) => page.items.length === 15),
    ).toBe(true);
  });
});
