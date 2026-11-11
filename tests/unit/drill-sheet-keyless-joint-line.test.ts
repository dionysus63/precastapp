import { PDFDocument, PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrillSheetResult } from "@/lib/drill-sheet";
import {
  fillDrillSheetTemplatePdf,
  SECTION_STACK_MARKER_FIELD,
} from "@/lib/drill-sheet-template-pdf";

// Cross-section cavity marker on a blank page: inner wall faces at x 200 and
// 305.8 (the 105.8 pt reference width, so the wall band is 11 pt), floor at
// y 100, bottom of the top slab at y 280.
const CAVITY = { x: 200, y: 100, width: 105.8, height: 180 };
const WALL_BAND = 11;
const INNER_LEFT = CAVITY.x;
const INNER_RIGHT = CAVITY.x + CAVITY.width;
const OUTER_LEFT = INNER_LEFT - WALL_BAND;
const OUTER_RIGHT = INNER_RIGHT + WALL_BAND;

async function templateWithSectionStack(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  doc
    .getForm()
    .createTextField(SECTION_STACK_MARKER_FIELD)
    .addToPage(page, { ...CAVITY, borderWidth: 0 });
  return doc.save();
}

/** A 6' base under a 3' riser, like the grease trap sheet Nick sent. */
function baseAndRiser(keyed: boolean): DrillSheetResult {
  return {
    rimElevation: 50.7,
    lowInvertElevation: 46.7,
    invertToTopFeet: 4,
    castingHeightFeet: 0.67,
    topSlabThicknessFeet: 0.67,
    sumpFeet: 7,
    rawAvailableFeet: 9,
    wallHeightFeet: 9,
    brickFeet: 0.66,
    hasKey: keyed,
    moldHasKey: keyed,
    keyHeightFeet: keyed ? 4 / 12 : 0,
    totalHeightFeet: 10.33,
    baseSlabThicknessFeet: 0.67,
    sections: [
      { role: "BASE", heightFeet: 6, hasBottomKey: false, hasTopKey: keyed },
      { role: "RISER", heightFeet: 3, hasBottomKey: keyed, hasTopKey: keyed },
    ],
    openings: [],
    wallPrice: 0,
    bootsPrice: 0,
    totalPrice: 0,
    errorMessage: null,
    warnings: [],
  } as unknown as DrillSheetResult;
}

type Segment = { x1: number; x2: number; y: number };

/** Horizontal lines the fill drew, left to right. */
async function horizontalLines(result: DrillSheetResult): Promise<Segment[]> {
  const drawLine = vi.spyOn(PDFPage.prototype, "drawLine");
  await fillDrillSheetTemplatePdf(
    await templateWithSectionStack(),
    {},
    [],
    result,
  );
  return drawLine.mock.calls
    .map(([options]) => options)
    .filter(({ start, end }) => Math.abs(start.y - end.y) < 0.001)
    .map(({ start, end }) => ({
      x1: Math.min(start.x, end.x),
      x2: Math.max(start.x, end.x),
      y: start.y,
    }));
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("base/riser joint line on the circular sheet cross-section", () => {
  it("runs across the whole structure when the mold has no key", async () => {
    const lines = await horizontalLines(baseAndRiser(false));
    // No key: the wall spans the full marker, so the joint sits 6' of 9' up.
    const jointY = CAVITY.y + (6 / 9) * CAVITY.height;
    const atJoint = lines.filter(
      (segment) => near(segment.y, jointY) && segment.x2 > OUTER_LEFT - 1,
    );

    // One unbroken line from outer wall face to outer wall face, not just a
    // short seam inside each wall band.
    expect(
      atJoint.some(
        (segment) => near(segment.x1, OUTER_LEFT) && near(segment.x2, OUTER_RIGHT),
      ),
    ).toBe(true);
  });

  it("still steps over the key and crosses the cavity when keyed", async () => {
    const lines = await horizontalLines(baseAndRiser(true));
    const rise = 10;
    const jointY = CAVITY.y + (6 / 9) * (CAVITY.height - rise);

    // Top-of-key line across the cavity, inner face to inner face.
    expect(
      lines.some(
        (segment) =>
          near(segment.y, jointY + rise) &&
          near(segment.x1, INNER_LEFT) &&
          near(segment.x2, INNER_RIGHT),
      ),
    ).toBe(true);
    // No flat line through the cavity at the outside joint plane.
    expect(
      lines.some(
        (segment) =>
          near(segment.y, jointY) &&
          segment.x1 < INNER_RIGHT &&
          segment.x2 > INNER_LEFT,
      ),
    ).toBe(false);
  });
});
