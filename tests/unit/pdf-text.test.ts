import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { contentDisposition, headerSafe } from "@/lib/http-responses";
import { setPdfFieldText, toWinAnsiText } from "@/lib/pdf-text";
import {
  MAIN_TABLE_LAYOUT,
  CONT_TABLE_LAYOUT,
} from "@/lib/quote-pdf-layout";
import {
  measureRowHeight,
  paginateQuoteLineItems,
} from "@/lib/quote-pdf-line-items";
import { paginateLineItems } from "@/lib/delivery-ticket-pdf-line-items";
import { DEFAULT_TABLE_LAYOUT } from "@/lib/delivery-ticket-pdf-layout";

async function helvetica() {
  const doc = await PDFDocument.create();
  return { doc, font: await doc.embedFont(StandardFonts.Helvetica) };
}

describe("toWinAnsiText", () => {
  it("spells out engineering marks, fractions and symbols", () => {
    expect(toWinAnsiText("48″ MH – 5′-6″ rim, ⅝ rebar, ≤ 2 % slope, −3 ft")).toBe(
      `48" MH – 5'-6" rim, 5/8 rebar, <= 2 % slope, -3 ft`,
    );
    expect(toWinAnsiText("✓ approved → ship, ✗ rejected")).toBe(
      "(ok) approved -> ship, (x) rejected",
    );
  });

  it("keeps everything Windows-1252 already has", () => {
    const text = "St. Mary’s “Annex” — 12° × 3½ € • café ¼";
    expect(toWinAnsiText(text)).toBe(text);
  });

  it("drops invisible characters and marks the unencodable", () => {
    expect(toWinAnsiText("A​B️")).toBe("AB");
    // ő decomposes to o + accent; emoji and Ł (no decomposition) can't.
    expect(toWinAnsiText("Pipe 🚧 ő Ł")).toBe("Pipe ? o ?");
  });

  it("always yields text Helvetica can encode", async () => {
    const { font } = await helvetica();
    const nasty = "⅞″ ≥ ½′ 🚧 Ł Ω 漢 ✓ − ‐ ⁄";
    expect(() => font.encodeText(toWinAnsiText(nasty))).not.toThrow();
    expect(() => font.widthOfTextAtSize(toWinAnsiText(nasty), 9)).not.toThrow();
  });
});

describe("response header helpers", () => {
  it("builds a Content-Disposition that Node accepts for any file name", () => {
    const value = contentDisposition("inline", "Plan – Rev 2 “final”.pdf");
    expect(() => new Headers({ "Content-Disposition": value })).not.toThrow();
    expect(value).toContain(`filename="Plan - Rev 2 final.pdf"`);
    expect(value).toContain(
      "filename*=UTF-8''Plan%20%E2%80%93%20Rev%202%20%E2%80%9Cfinal%E2%80%9D.pdf",
    );
  });

  it("percent-encodes header values so any name round-trips", () => {
    const name = "CB – 4x4 50%.pdf";
    expect(() => new Headers({ "X-Name": headerSafe(name) })).not.toThrow();
    expect(decodeURIComponent(headerSafe(name))).toBe(name);
  });
});

describe("setPdfFieldText", () => {
  it("lifts maxLength, normalizes text, and shrinks a long value to fit", async () => {
    const { doc, font } = await helvetica();
    const page = doc.addPage([400, 200]);
    const field = doc.getForm().createTextField("Project Name");
    field.setMaxLength(20);
    field.addToPage(page, { x: 10, y: 10, width: 150, height: 14, font });
    field.setFontSize(9);

    // ~45 characters: about 180pt wide at 9pt, so it must shrink to fit.
    const value = "St. Mary’s Church Parking Lot — Phase 2 (48″)";
    setPdfFieldText(field, value, { font });

    expect(field.getMaxLength()).toBeUndefined();
    expect(field.getText()).toBe(toWinAnsiText(value));
    const da = field.acroField.getDefaultAppearance() ?? "";
    const size = Number(/(\d+(?:\.\d+)?)\s+Tf/.exec(da)?.[1]);
    expect(size).toBeLessThan(9);
    expect(size).toBeGreaterThan(5);
    expect(font.widthOfTextAtSize(field.getText()!, size)).toBeLessThanOrEqual(148);
    // Flattening (what every template fill does) must not throw.
    expect(() => doc.getForm().flatten()).not.toThrow();
  });
});

describe("rows taller than a page", () => {
  const longNote = Array.from(
    { length: 120 },
    (_, index) => `Exclusion ${index + 1}: no dewatering, traffic control or restoration.`,
  ).join("<br>");

  it("splits a quote note across pages instead of drawing past the bottom", async () => {
    const { font } = await helvetica();
    const pages = paginateQuoteLineItems(
      [
        { item: "SMH-1", qty: "1", description: "Manhole", unitPrice: "$1", total: "$1" },
        { item: "", qty: "", description: longNote, unitPrice: "", total: "", isNoteLine: true },
      ],
      font,
    );

    expect(pages.length).toBeGreaterThan(2);
    for (const page of pages) {
      const layout = page.isLastPage ? MAIN_TABLE_LAYOUT : CONT_TABLE_LAYOUT;
      const used = page.items.reduce(
        (sum, item) => sum + measureRowHeight(item, font, layout),
        0,
      );
      expect(used).toBeLessThanOrEqual(layout.tableTopY - layout.tableBottomY);
    }
    const drawnLines = pages
      .flatMap((page) => page.items)
      .flatMap((item) => item.descriptionLines ?? []);
    expect(drawnLines.filter((line) => line.startsWith("Exclusion"))).toHaveLength(120);
  });

  it("splits a ticket row the same way", async () => {
    const { font } = await helvetica();
    const pages = paginateLineItems(
      [{ qty: "1", unit: "EA", productCode: "NOTE", description: longNote }],
      font,
    );
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0]!.items[0]!.qty).toBe("1");
    expect(pages[1]!.items[0]!.qty).toBe("");
    const layout = DEFAULT_TABLE_LAYOUT;
    for (const page of pages) {
      const lines = page.items.reduce(
        (sum, item) => sum + (item.descriptionLines?.length ?? 1),
        0,
      );
      expect(lines * layout.lineHeight).toBeLessThanOrEqual(
        layout.tableTopY - layout.tableBottomY,
      );
    }
  });
});
