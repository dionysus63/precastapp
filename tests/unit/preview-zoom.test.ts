import { describe, expect, it } from "vitest";
import {
  PDF_ZOOM_STEPS,
  isPdfZoom,
  isPreviewZoomScreen,
  parsePdfZoomParam,
  pdfZoomFromPercent,
  pdfZoomIndex,
  pdfZoomLabel,
  pdfZoomToPercent,
  pictureDpiForZoom,
} from "@/lib/preview-zoom";

describe("preview zoom steps", () => {
  it("starts fitted and only goes up", () => {
    expect(PDF_ZOOM_STEPS[0]).toBe(1);
    expect([...PDF_ZOOM_STEPS]).toEqual(
      [...PDF_ZOOM_STEPS].sort((a, b) => a - b),
    );
  });

  it("knows a step from any other number", () => {
    expect(isPdfZoom(1.5)).toBe(true);
    expect(isPdfZoom(1.4)).toBe(false);
    expect(isPdfZoom("1.5")).toBe(false);
    expect(isPdfZoom(null)).toBe(false);
  });

  it("finds a step's position, and takes anything else as fitted", () => {
    expect(pdfZoomIndex(1)).toBe(0);
    expect(pdfZoomIndex(2)).toBe(3);
    expect(pdfZoomIndex(7)).toBe(0);
    expect(pdfZoomIndex(undefined)).toBe(0);
  });

  it('says "Fit" when fitted and the percent when zoomed', () => {
    expect(pdfZoomLabel(1)).toBe("Fit");
    expect(pdfZoomLabel(1.25)).toBe("125%");
    expect(pdfZoomLabel(3)).toBe("300%");
  });
});

describe("the zoom a user keeps for a screen", () => {
  it("is stored as a percent and read back as the same step", () => {
    for (const zoom of PDF_ZOOM_STEPS) {
      expect(pdfZoomFromPercent(pdfZoomToPercent(zoom))).toBe(zoom);
    }
    expect(pdfZoomToPercent(1.25)).toBe(125);
  });

  it("reads a missing or unknown percent as fitted", () => {
    expect(pdfZoomFromPercent(undefined)).toBe(1);
    expect(pdfZoomFromPercent(null)).toBe(1);
    expect(pdfZoomFromPercent(140)).toBe(1);
    expect(pdfZoomFromPercent("150")).toBe(1);
  });

  it("only takes the screens that are listed", () => {
    expect(isPreviewZoomScreen("invoice-list")).toBe(true);
    expect(isPreviewZoomScreen("toString")).toBe(false);
    expect(isPreviewZoomScreen("somewhere-else")).toBe(false);
    expect(isPreviewZoomScreen(3)).toBe(false);
  });
});

describe("a page picture's zoom", () => {
  it("reads ?zoom= and falls back to fitted", () => {
    expect(parsePdfZoomParam("1.5")).toBe(1.5);
    expect(parsePdfZoomParam("3")).toBe(3);
    expect(parsePdfZoomParam(null)).toBe(1);
    expect(parsePdfZoomParam("")).toBe(1);
    expect(parsePdfZoomParam("40")).toBe(1);
    expect(parsePdfZoomParam("abc")).toBe(1);
  });

  it("is drawn sharper the further it is zoomed, up to print quality", () => {
    expect(pictureDpiForZoom(110, 1)).toBe(110);
    expect(pictureDpiForZoom(110, 1.5)).toBe(165);
    expect(pictureDpiForZoom(110, 2)).toBe(220);
    expect(pictureDpiForZoom(110, 3)).toBe(300);
    // A picture already asked for above print quality is never made coarser.
    expect(pictureDpiForZoom(400, 2)).toBe(400);
  });
});
