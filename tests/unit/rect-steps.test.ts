import { readFile } from "fs/promises";
import path from "path";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  RECT_STEPS_POSITIONS,
  normalizeRectStepsPosition,
  type RectStepsPosition,
} from "@/lib/rect-steps";
import {
  computeRectStructure,
  type RectOpeningInput,
  type RectStructureInput,
  type RectTemplateConfig,
} from "@/lib/rect-structure";
import { planStepsRect } from "@/lib/rect-structure-diagram";
import {
  buildRectSheetFieldMap,
  fillRectSheetTemplatePdf,
} from "@/lib/rect-template-pdf";

// Steps on a rectangular structure: one of twelve spots, three per wall,
// named the way the sheet is read. Off-center steps sit the template's
// "Steps From Corner" distance from the closer inside corner.
const TEMPLATE: RectTemplateConfig = {
  wallThicknessInches: 8,
  baseSlabThicknessInches: 8,
  topSlabThicknessInches: 8,
  minimumBrickInches: 3,
  sumpMode: "FIXED",
  sumpFixedInches: 24,
  wallPricePerFoot: 0,
  minPricingHeightFeet: 0,
  topSlabPrice: 0,
  baseSlabPrice: 0,
  stepsOffsetInches: 13,
};

const CATALOG = [
  {
    pipeMaterial: "HDPE",
    pipeSizeInches: 15,
    openingWidthInches: 24,
    openingHeightInches: 24,
    pipeWallThicknessInches: 1.5,
    pricePerOpening: null,
  },
];

function opening(overrides: Partial<RectOpeningInput>): RectOpeningInput {
  return {
    label: "A",
    wall: "UP",
    pipeMaterial: "HDPE",
    pipeSizeInches: 15,
    invertElevation: 99.5,
    placement: "CENTERED",
    offsetInches: null,
    widthOverrideInches: null,
    ...overrides,
  };
}

// A 6' x 4' box. With nothing else said, one pipe on the Left wall, so the
// structure calculates and the other three walls are free for steps.
function input(overrides: Partial<RectStructureInput> = {}): RectStructureInput {
  return {
    rimElevation: 103.4,
    castingHeightFeet: 0.42,
    insideLengthFeet: 6,
    insideWidthFeet: 4,
    baseAttached: true,
    template: TEMPLATE,
    openingSizes: CATALOG,
    openings: [opening({ wall: "LEFT" })],
    sectionHeightsFeet: [],
    jointKeys: [],
    topSlabOpening: { lengthInches: 30, widthInches: 30, side: "UP" },
    ...overrides,
  };
}

describe("where each of the twelve spots lands", () => {
  // Inches from the wall's LEFT inside face as seen from inside the box,
  // the way pipe openings are placed. The Up wall reads like the page; the
  // Down wall is mirrored, the Right wall runs from the top of the page
  // down and the Left wall from the bottom up.
  const expected: Record<RectStepsPosition, { wall: string; center: number; offset: number | null }> = {
    UP_LEFT: { wall: "UP", center: 13, offset: 13 },
    UP_MIDDLE: { wall: "UP", center: 36, offset: null },
    UP_RIGHT: { wall: "UP", center: 59, offset: 13 },
    RIGHT_TOP: { wall: "RIGHT", center: 13, offset: 13 },
    RIGHT_MIDDLE: { wall: "RIGHT", center: 24, offset: null },
    RIGHT_BOTTOM: { wall: "RIGHT", center: 35, offset: 13 },
    DOWN_LEFT: { wall: "DOWN", center: 59, offset: 13 },
    DOWN_MIDDLE: { wall: "DOWN", center: 36, offset: null },
    DOWN_RIGHT: { wall: "DOWN", center: 13, offset: 13 },
    LEFT_TOP: { wall: "LEFT", center: 35, offset: 13 },
    LEFT_MIDDLE: { wall: "LEFT", center: 24, offset: null },
    LEFT_BOTTOM: { wall: "LEFT", center: 13, offset: 13 },
  };

  for (const position of RECT_STEPS_POSITIONS) {
    it(position, () => {
      const result = computeRectStructure(
        input({ openings: [opening({ wall: "UP" })], stepsPosition: position }),
      );
      expect(result.errorMessage).toBeNull();
      expect(result.steps).toMatchObject({
        position,
        wall: expected[position].wall,
        centerInches: expected[position].center,
        offsetInches: expected[position].offset,
      });
    });
  }

  it("draws each spot on the side of the plan its name says", () => {
    const at = (position: RectStepsPosition) => {
      const rect = planStepsRect(
        computeRectStructure(input({ stepsPosition: position })),
      )!;
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    };
    // x runs left to right, y from the top of the page down.
    expect(at("UP_LEFT").x).toBeLessThan(0.5);
    expect(at("UP_LEFT").y).toBeLessThan(0.5);
    expect(at("UP_RIGHT").x).toBeGreaterThan(0.5);
    expect(at("DOWN_LEFT").x).toBeLessThan(0.5);
    expect(at("DOWN_LEFT").y).toBeGreaterThan(0.5);
    expect(at("DOWN_RIGHT").x).toBeGreaterThan(0.5);
    expect(at("RIGHT_TOP").y).toBeLessThan(0.5);
    expect(at("RIGHT_TOP").x).toBeGreaterThan(0.5);
    expect(at("RIGHT_BOTTOM").y).toBeGreaterThan(0.5);
    expect(at("LEFT_TOP").y).toBeLessThan(0.5);
    expect(at("LEFT_TOP").x).toBeLessThan(0.5);
    expect(at("LEFT_BOTTOM").y).toBeGreaterThan(0.5);
    expect(at("UP_MIDDLE").x).toBeCloseTo(0.5, 4);
    expect(at("LEFT_MIDDLE").y).toBeCloseTo(0.5, 4);
  });
});

describe("a structure without steps", () => {
  it("has none and says nothing about them", () => {
    const result = computeRectStructure(input());
    expect(result.steps).toBeNull();
    expect(result.warnings.join(" ")).not.toMatch(/steps/i);
    expect(planStepsRect(result)).toBeNull();
  });

  it("reads a blank or unknown pick as no steps", () => {
    expect(normalizeRectStepsPosition("")).toBeNull();
    expect(normalizeRectStepsPosition(null)).toBeNull();
    expect(normalizeRectStepsPosition("TOP_LEFT")).toBeNull();
    expect(normalizeRectStepsPosition("UP_LEFT")).toBe("UP_LEFT");
  });
});

describe("the template's Steps From Corner distance", () => {
  const noDistance = { ...TEMPLATE, stepsOffsetInches: null };

  it("is needed for a spot off the middle", () => {
    const result = computeRectStructure(
      input({ template: noDistance, stepsPosition: "UP_LEFT" }),
    );
    expect(result.errorMessage).toMatch(/Steps From Corner/);
    // The pick is kept so saving the structure does not lose it.
    expect(result.steps?.position).toBe("UP_LEFT");
    expect(result.steps?.centerInches).toBeNull();
  });

  it("is not needed in the middle of a wall", () => {
    const result = computeRectStructure(
      input({ template: noDistance, stepsPosition: "UP_MIDDLE" }),
    );
    expect(result.errorMessage).toBeNull();
    expect(result.steps?.centerInches).toBe(36);
  });

  it("warns when it does not fit the wall", () => {
    const result = computeRectStructure(
      input({
        template: { ...TEMPLATE, stepsOffsetInches: 30 },
        stepsPosition: "RIGHT_TOP",
      }),
    );
    expect(result.errorMessage).toBeNull();
    expect(result.warnings.join(" ")).toMatch(/do not fit the Right wall/);
  });
});

describe("steps and a pipe opening on the same wall", () => {
  it("warns when they share a stretch of wall, and still calculates", () => {
    // 24" opening in the middle of the 72" Up wall: 24" to 48".
    const result = computeRectStructure(
      input({ openings: [opening({ wall: "UP" })], stepsPosition: "UP_MIDDLE" }),
    );
    expect(result.errorMessage).toBeNull();
    expect(result.steps?.crossesOpenings).toEqual(["A"]);
    expect(result.warnings.join(" ")).toMatch(
      /Steps on the Up wall cross opening A/,
    );
  });

  it("says nothing when they clear each other", () => {
    // Steps 13" from the corner take 6" to 20"; the opening starts at 24".
    const result = computeRectStructure(
      input({ openings: [opening({ wall: "UP" })], stepsPosition: "UP_LEFT" }),
    );
    expect(result.steps?.crossesOpenings).toEqual([]);
    expect(result.warnings.join(" ")).not.toMatch(/steps/i);
  });

  it("ignores openings on other walls", () => {
    const result = computeRectStructure(
      input({ openings: [opening({ wall: "DOWN" })], stepsPosition: "UP_MIDDLE" }),
    );
    expect(result.steps?.crossesOpenings).toEqual([]);
  });
});

describe("steps on the printed sheet", () => {
  const meta = {
    structureNumber: "CB-8",
    contractor: "ABC Paving",
    project: "Route 25 Drainage",
    templateName: "",
    castingName: null,
  };

  async function sheetText(structure: RectStructureInput): Promise<string> {
    const template = await readFile(
      path.join(process.cwd(), "assets/templates/rect-calibrated/topslab-base.pdf"),
    );
    const result = computeRectStructure(structure);
    const filled = await fillRectSheetTemplatePdf(
      new Uint8Array(template),
      buildRectSheetFieldMap(meta, result),
      result,
    );
    // Everything the app draws lands in the first page's content streams,
    // with its text hex-encoded.
    const doc = await PDFDocument.load(filled);
    const contents = doc.getPage(0).node.Contents();
    const streams =
      contents instanceof PDFArray
        ? contents.asArray().map((ref) => doc.context.lookup(ref))
        : [contents];
    let drawn = "";
    for (const stream of streams) {
      if (stream instanceof PDFRawStream) {
        drawn += Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      }
    }
    return drawn;
  }

  const hex = (text: string) => Buffer.from(text, "latin1").toString("hex").toUpperCase();
  const count = (drawn: string, text: string) =>
    drawn.toUpperCase().split(hex(text)).length - 1;

  it("prints nothing about steps when the structure has none", async () => {
    const drawn = await sheetText(input());
    expect(count(drawn, "STEPS")).toBe(0);
  });

  for (const position of RECT_STEPS_POSITIONS) {
    it(`labels the steps at ${position}, with the corner distance when off center`, async () => {
      const drawn = await sheetText(input({ stepsPosition: position }));
      expect(count(drawn, "STEPS")).toBe(1);
      expect(count(drawn, '13"')).toBe(position.endsWith("MIDDLE") ? 0 : 1);
    });
  }

  it("still prints them on a two-piece wall with pipes all around", async () => {
    const drawn = await sheetText(
      input({
        rimElevation: 110,
        sectionHeightsFeet: [5, 4],
        jointKeys: [true],
        openings: [
          opening({ label: "A", wall: "UP", invertElevation: 101.5 }),
          opening({ label: "B", wall: "DOWN", invertElevation: 102.2 }),
          opening({ label: "C", wall: "RIGHT", invertElevation: 104.9 }),
        ],
        stepsPosition: "UP_LEFT",
      }),
    );
    expect(count(drawn, "STEPS")).toBe(1);
    expect(count(drawn, '13"')).toBe(1);
  });
});
