import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  measureRowHeight,
  wrapText,
  type QuoteDrawLineItem,
} from "@/lib/quote-pdf-line-items";
import {
  COL_ITEM_NUM_WIDTH,
  MAIN_TABLE_LAYOUT,
} from "@/lib/quote-pdf-layout";

const CELL_INSET = 4.5;

async function getHelvetica() {
  const doc = await PDFDocument.create();
  return doc.embedFont(StandardFonts.Helvetica);
}

function lineItem(item: string): QuoteDrawLineItem {
  return {
    item,
    qty: "1",
    description: "Short description",
    unitPrice: "$1.00",
    total: "$1.00",
  };
}

describe("quote PDF line item wrapping", () => {
  it("prefers a hyphen when an item number must wrap", async () => {
    const font = await getHelvetica();
    const maxWidth = font.widthOfTextAtSize("ABC-DE", 9);

    expect(wrapText("ABC-DEF", font, 9, maxWidth)).toEqual(["ABC-", "DEF"]);
  });

  it("prefers a space when an item number must wrap", async () => {
    const font = await getHelvetica();
    const maxWidth = font.widthOfTextAtSize("ABC", 9);

    expect(wrapText("ABC DEF", font, 9, maxWidth)).toEqual(["ABC", "DEF"]);
  });

  it("breaks an oversized item number into lines within the column", async () => {
    const font = await getHelvetica();
    const maxWidth = COL_ITEM_NUM_WIDTH - CELL_INSET * 2;
    const lines = wrapText("Ballast Block - Type B", font, 9, maxWidth);

    expect(lines.length).toBeGreaterThan(1);
    expect(
      lines.every((line) => font.widthOfTextAtSize(line, 9) <= maxWidth),
    ).toBe(true);
  });

  it("expands the row height to fit a wrapped item number", async () => {
    const font = await getHelvetica();
    const shortHeight = measureRowHeight(
      lineItem("B-1"),
      font,
      MAIN_TABLE_LAYOUT,
    );
    const wrappedHeight = measureRowHeight(
      lineItem("Ballast Block - Type B"),
      font,
      MAIN_TABLE_LAYOUT,
    );

    expect(wrappedHeight).toBeGreaterThan(shortHeight);
  });
});
