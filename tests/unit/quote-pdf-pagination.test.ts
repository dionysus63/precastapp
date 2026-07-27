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

  it("packs the last page full instead of spilling one row", () => {
    // 26 two-line rows (the Holbrook quote shape): must be 2 pages, not 3.
    const items = Array.from({ length: 26 }, (_, i) => structureRow(i));
    const pages = paginateQuoteLineItems(items, mockFont);

    expect(pages).toHaveLength(2);
    expect(pages[pages.length - 1].isLastPage).toBe(true);
    // The totals page carries as many rows as fit — never a lone straggler
    // while the previous page has free space.
    expect(pages[pages.length - 1].items.length).toBeGreaterThan(1);
    const totalRows = pages.reduce((sum, page) => sum + page.items.length, 0);
    expect(totalRows).toBe(26);
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
    expect(pages[pages.length - 1].items.length).toBeGreaterThan(1);
  });
});
