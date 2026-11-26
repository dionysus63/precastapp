import { readFile } from "fs/promises";
import path from "path";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  computeRectStructure,
  type RectOpeningInput,
  type RectStructureInput,
  type RectTemplateConfig,
} from "@/lib/rect-structure";
import {
  buildRectSheetFieldMap,
  fillRectSheetTemplatePdf,
} from "@/lib/rect-template-pdf";

// An opening placed off the center of its wall prints a dimension from the
// inside wall face it is measured from to its centerline. Where the line
// has no room the callout says the distance in words, by the side of the
// page.
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
  stepsOffsetInches: 12,
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

// A 4' x 4' box with 4.5' walls: a 24" opening 20" off the floor.
function input(overrides: Partial<RectStructureInput> = {}): RectStructureInput {
  return {
    rimElevation: 103.4,
    castingHeightFeet: 0.42,
    insideLengthFeet: 4,
    insideWidthFeet: 4,
    baseAttached: true,
    template: TEMPLATE,
    openingSizes: CATALOG,
    openings: [opening({})],
    sectionHeightsFeet: [],
    jointKeys: [],
    topSlabOpening: { lengthInches: 30, widthInches: 30, side: "UP" },
    ...overrides,
  };
}

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
  // Everything the app draws lands in the first page's content streams, each
  // piece of text hex-encoded between angle brackets.
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
  return drawn.toUpperCase();
}

/** How many times exactly this text was drawn. */
function count(drawn: string, text: string): number {
  const hex = Buffer.from(text, "latin1").toString("hex").toUpperCase();
  return drawn.split(`<${hex}>`).length - 1;
}

describe("the dimension to an off-center opening", () => {
  it("prints nothing extra for an opening in the middle of its wall", async () => {
    const drawn = await sheetText(input());
    expect(count(drawn, '17"')).toBe(0);
    expect(drawn).not.toContain(Buffer.from("FROM", "latin1").toString("hex").toUpperCase());
  });

  for (const wall of ["UP", "DOWN", "LEFT", "RIGHT"] as const) {
    for (const placement of ["FROM_LEFT", "FROM_RIGHT"] as const) {
      it(`dimensions a ${wall} wall opening ${placement}, in place of the words`, async () => {
        const drawn = await sheetText(
          input({ openings: [opening({ wall, placement, offsetInches: 17 })] }),
        );
        expect(count(drawn, '17"')).toBe(1);
        for (const side of ["LEFT", "RIGHT", "TOP", "BOTTOM"]) {
          expect(count(drawn, `17" FROM ${side}`)).toBe(0);
        }
        expect(count(drawn, "TO CENTERLINE")).toBe(0);
      });
    }
  }

  it("keeps a half inch", async () => {
    const drawn = await sheetText(
      input({
        openings: [opening({ placement: "FROM_LEFT", offsetInches: 16.5 })],
      }),
    );
    expect(count(drawn, '16.5"')).toBe(1);
  });

  it("dimensions each of two openings on one wall", async () => {
    const drawn = await sheetText(
      input({
        insideLengthFeet: 6,
        openings: [
          opening({ label: "A", placement: "FROM_LEFT", offsetInches: 17 }),
          opening({ label: "B", placement: "FROM_RIGHT", offsetInches: 19 }),
        ],
      }),
    );
    expect(count(drawn, '17"')).toBe(1);
    expect(count(drawn, '19"')).toBe(1);
  });

  it("still dimensions the opening beside steps and a two-piece wall", async () => {
    const drawn = await sheetText(
      input({
        rimElevation: 110,
        insideLengthFeet: 6,
        sectionHeightsFeet: [5, 4],
        jointKeys: [true],
        stepsPosition: "UP_RIGHT",
        openings: [
          opening({ invertElevation: 101.5, placement: "FROM_LEFT", offsetInches: 23 }),
        ],
      }),
    );
    expect(count(drawn, '23"')).toBe(1);
    expect(count(drawn, "STEPS")).toBe(1);
  });

  // A 6" wall is all opening: no room for a line above or below it.
  describe("with no room for the line", () => {
    const cramped = (wall: RectOpeningInput["wall"], placement: RectOpeningInput["placement"]) =>
      input({
        rimElevation: 101,
        template: { ...TEMPLATE, sumpFixedInches: 0 },
        openings: [opening({ wall, placement, offsetInches: 17 })],
      });

    it("says it in words, by the side of the page", async () => {
      const cases = [
        ["UP", "FROM_LEFT", "LEFT"],
        ["UP", "FROM_RIGHT", "RIGHT"],
        ["DOWN", "FROM_LEFT", "RIGHT"],
        ["DOWN", "FROM_RIGHT", "LEFT"],
        ["RIGHT", "FROM_LEFT", "TOP"],
        ["RIGHT", "FROM_RIGHT", "BOTTOM"],
        ["LEFT", "FROM_LEFT", "BOTTOM"],
        ["LEFT", "FROM_RIGHT", "TOP"],
      ] as const;
      for (const [wall, placement, side] of cases) {
        const drawn = await sheetText(cramped(wall, placement));
        expect(count(drawn, '17"')).toBe(0);
        expect(count(drawn, `17" FROM ${side}`)).toBe(1);
        // The words stand in for a dimension drawn to the centerline, so
        // they have to say what the number runs to.
        expect(count(drawn, "TO CENTERLINE")).toBe(1);
      }
    });

    it("does not say centerline for an opening held against a wall end", async () => {
      const drawn = await sheetText(
        input({
          rimElevation: 101,
          template: { ...TEMPLATE, sumpFixedInches: 0 },
          openings: [opening({ placement: "TOUCH_LEFT" })],
        }),
      );
      expect(count(drawn, "TO LEFT END")).toBe(1);
      expect(count(drawn, "TO CENTERLINE")).toBe(0);
    });
  });
});
