import { PDFDocument, PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComputedOpening } from "@/lib/drill-sheet";
import {
  type PenetrationLabelLayoutInput,
  countPenetrationLabelOverlaps,
  defaultPenetrationLabelPlacement,
  layoutPenetrationLabels,
} from "@/lib/drill-sheet-label-layout";
import {
  fillDrillSheetTemplatePdf,
  PLAN_CIRCLE_MARKER_FIELD,
} from "@/lib/drill-sheet-template-pdf";

// Helvetica widths at the 11 pt callout size for `12"Ø` over `@ +19"`.
const CALLOUT_WIDTHS = [24.7, 36.8];
// `12"Ø @ Bottom` printed above the outlet arrow.
const OUTLET_CALLOUT_WIDTH = 66;

function baseCircle(angles: number[]): PenetrationLabelLayoutInput {
  return {
    inlets: angles.map((angleDegrees) => ({
      angleDegrees,
      calloutLineWidthsPt: CALLOUT_WIDTHS,
    })),
    outlet: { calloutWidthPt: OUTLET_CALLOUT_WIDTH },
  };
}

function normalPlacements(input: PenetrationLabelLayoutInput) {
  return input.inlets.map(defaultPenetrationLabelPlacement);
}

describe("label layout around the circular sheet's plan circle", () => {
  it("leaves a pipe with nothing near it exactly as it always printed", () => {
    for (let angle = 0; angle < 360; angle += 5) {
      // Riser circle: no outlet artwork, one pipe.
      const riser: PenetrationLabelLayoutInput = {
        inlets: [{ angleDegrees: angle, calloutLineWidthsPt: CALLOUT_WIDTHS }],
      };
      expect(layoutPenetrationLabels(riser)).toEqual(normalPlacements(riser));
    }
    for (const angle of [60, 90, 135, 180, 225, 270, 300]) {
      const base = baseCircle([angle]);
      expect(layoutPenetrationLabels(base)).toEqual(normalPlacements(base));
    }
  });

  it("keeps the normal layout for pipes spread around the circle", () => {
    const input = baseCircle([90, 180, 270]);
    expect(layoutPenetrationLabels(input)).toEqual(normalPlacements(input));
  });

  it("clears pipe B's letter when pipe C sits 30 degrees away", () => {
    // The sheet Nick sent: B at the bottom, C just clockwise of it. Printed
    // the normal way, C's size text lands on B's circled letter.
    const input = baseCircle([180, 210]);
    expect(
      countPenetrationLabelOverlaps(input, normalPlacements(input)),
    ).toBeGreaterThan(0);

    const placements = layoutPenetrationLabels(input);
    expect(countPenetrationLabelOverlaps(input, placements)).toBe(0);
    // B is untouched; C's size text moves over next to C's own letter.
    expect(placements[0]).toEqual(normalPlacements(input)[0]);
    expect(placements[1]!.badgeSide).toBe(1);
    expect(placements[1]!.calloutSide).toBe(1);
  });

  it("finds room for three and four pipes in a row", () => {
    for (const angles of [
      [150, 180, 210],
      [90, 120, 150],
      [120, 150, 180, 210],
    ]) {
      const input = baseCircle(angles);
      expect(
        countPenetrationLabelOverlaps(input, normalPlacements(input)),
      ).toBeGreaterThan(0);
      expect(
        countPenetrationLabelOverlaps(input, layoutPenetrationLabels(input)),
      ).toBe(0);
    }
  });

  it("keeps a pipe beside the outlet off the outlet's letter and text", () => {
    for (const angle of [20, 30, 40, 330, 340]) {
      const input = baseCircle([angle]);
      expect(
        countPenetrationLabelOverlaps(input, layoutPenetrationLabels(input)),
      ).toBe(0);
    }
    const input = baseCircle([30]);
    expect(
      countPenetrationLabelOverlaps(input, normalPlacements(input)),
    ).toBeGreaterThan(0);
  });

  it("clears every pair of pipes 30 or more degrees apart, away from the outlet", () => {
    for (let first = 60; first <= 270; first += 5) {
      for (let gap = 30; gap <= 90 && first + gap <= 300; gap += 5) {
        const input = baseCircle([first, first + gap]);
        expect(
          countPenetrationLabelOverlaps(input, layoutPenetrationLabels(input)),
          `pipes at ${first} and ${first + gap} degrees`,
        ).toBe(0);
      }
    }
  });

  it("moves a long callout out so it does not cover its own arrow", () => {
    const inlet = { angleDegrees: 180, calloutLineWidthsPt: [24.7, 60] };
    const placement = defaultPenetrationLabelPlacement(inlet);
    // Half the text (30) plus the mask padding must sit clear of the shaft.
    expect(placement.calloutTangentOffsetPt).toBeGreaterThan(32);
    const short = { angleDegrees: 180, calloutLineWidthsPt: CALLOUT_WIDTHS };
    expect(defaultPenetrationLabelPlacement(short).calloutTangentOffsetPt).toBe(
      27,
    );
  });
});

// A plan circle of the template's 87 pt reference radius on a blank page.
const CIRCLE = { x: 150, y: 400, width: 174, height: 174 };

async function templateWithPlanCircle(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  doc
    .getForm()
    .createTextField(PLAN_CIRCLE_MARKER_FIELD)
    .addToPage(page, { ...CIRCLE, borderWidth: 0 });
  return doc.save();
}

function opening(
  label: string,
  angleDegrees: number,
  riseInches: number,
): ComputedOpening {
  return {
    label,
    isLowInvert: riseInches === 0,
    angleDegrees,
    pipeSizeInches: 6,
    pipeType: "DR-18",
    invertElevation: 45.91 + riseInches / 12,
    holeDiameterInches: 12,
    bootModel: "S106-12BT",
    hasBoot: true,
    containingSectionRole: "BASE",
    sectionBottomToOpeningBottomInches: riseInches,
  } as unknown as ComputedOpening;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("filled circular sheet with two pipes close together", () => {
  it("draws no callout text over a circled pipe letter", async () => {
    const drawCircle = vi.spyOn(PDFPage.prototype, "drawCircle");
    const drawRectangle = vi.spyOn(PDFPage.prototype, "drawRectangle");

    await fillDrillSheetTemplatePdf(await templateWithPlanCircle(), {}, [
      opening("A", 0, 0),
      opening("B", 180, 19),
      opening("C", 210, 2),
    ]);

    const badges = drawCircle.mock.calls.map(([options]) => ({
      x: options?.x ?? 0,
      y: options?.y ?? 0,
      radius: options?.size ?? 0,
    }));
    // White masks behind the callouts: the outlet's plus one per inlet.
    const masks = drawRectangle.mock.calls.map(([options]) => ({
      left: options?.x ?? 0,
      bottom: options?.y ?? 0,
      right: (options?.x ?? 0) + (options?.width ?? 0),
      top: (options?.y ?? 0) + (options?.height ?? 0),
    }));
    expect(badges).toHaveLength(2);
    expect(masks).toHaveLength(3);

    for (const badge of badges) {
      for (const mask of masks) {
        const dx = Math.max(mask.left - badge.x, 0, badge.x - mask.right);
        const dy = Math.max(mask.bottom - badge.y, 0, badge.y - mask.top);
        expect(Math.hypot(dx, dy)).toBeGreaterThan(badge.radius);
      }
    }
  });
});
