// Checks for the rectangular structure calculator (lib/rect-structure.ts).
// Run: npx tsx scripts/test-rect-structure.ts

import {
  CONCRETE_PCF,
  computeRectDefaultSumpFeet,
  computeRectStructure,
  computeRectWallHeightFeet,
  getRectStructureElevations,
  lookupRectOpeningSize,
  slabWeightLbs,
  type RectOpeningInput,
  type RectOpeningSizeEntry,
  type RectStructureInput,
  type RectTemplateConfig,
} from "@/lib/rect-structure";

let failures = 0;

function expect(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ok: ${message}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${message}`);
  }
}

function approx(a: number | null, b: number, tolerance = 1e-3): boolean {
  return a != null && Math.abs(a - b) <= tolerance;
}

const catalog: RectOpeningSizeEntry[] = [
  {
    pipeMaterial: "PVC SDR35",
    pipeSizeInches: 12,
    openingWidthInches: 18,
    openingHeightInches: 16,
    pricePerOpening: 50,
  },
  {
    pipeMaterial: "RCP",
    pipeSizeInches: 18,
    openingWidthInches: 26,
    openingHeightInches: 24,
    pricePerOpening: 75,
  },
];

function template(
  overrides: Partial<RectTemplateConfig> = {},
): RectTemplateConfig {
  return {
    wallThicknessInches: 6,
    baseSlabThicknessInches: 8,
    topSlabThicknessInches: 8,
    minimumBrickInches: 0,
    sumpMode: "DEFAULT",
    sumpFixedInches: null,
    wallPricePerFoot: 100,
    minPricingHeightFeet: 4,
    topSlabPrice: 300,
    baseSlabPrice: 200,
    ...overrides,
  };
}

function opening(overrides: Partial<RectOpeningInput> = {}): RectOpeningInput {
  return {
    label: "A",
    wall: "UP",
    pipeMaterial: "PVC SDR35",
    pipeSizeInches: 12,
    invertElevation: 96,
    angleDegrees: null,
    placement: "CENTERED",
    offsetInches: null,
    widthOverrideInches: null,
    ...overrides,
  };
}

function input(overrides: Partial<RectStructureInput> = {}): RectStructureInput {
  return {
    rimElevation: 100,
    castingHeightFeet: 0.5,
    insideLengthFeet: 4,
    insideWidthFeet: 4,
    hasTopSlab: true,
    hasBaseSlab: true,
    baseAttached: true,
    template: template(),
    openingSizes: catalog,
    openings: [opening()],
    sectionHeightsFeet: [],
    jointKeys: [],
    topSlabOpening: { lengthInches: 30, widthInches: 30, side: "UP" },
    ...overrides,
  };
}

// T1: catalog lookup is material/size keyed and case-insensitive.
{
  console.log("T1: opening catalog lookup");
  expect(
    lookupRectOpeningSize(catalog, "pvc sdr35", 12)?.openingWidthInches === 18,
    "case-insensitive material match",
  );
  expect(lookupRectOpeningSize(catalog, "PVC SDR35", 10) == null, "unknown size misses");
}

// T2: default sump = (opening height - pipe size) / 2, pipe centered.
{
  console.log("T2: default sump");
  expect(
    approx(computeRectDefaultSumpFeet(16, 12), 2 / 12),
    'sump is 2" for a 12" pipe in a 16" opening',
  );
}

// T3: wall height rounds down to 6" increments (same as circular); remainder is brick.
{
  console.log("T3: wall height rounding");
  const { wallHeightFeet, brickFeet } = computeRectWallHeightFeet(5.4375, 0);
  // 5.4375' -> wall 5'-0" (nearest 6" step down), brick 5.25".
  expect(approx(wallHeightFeet, 5), "wall rounds down to 5'-0\"");
  expect(approx(brickFeet, 5.25 / 12), 'brick keeps the leftover 5.25"');

  const exact = computeRectWallHeightFeet(5.5, 0);
  expect(
    approx(exact.wallHeightFeet, 5.5) && approx(exact.brickFeet, 0),
    "an exact 6\" multiple pours full height with no brick",
  );

  const withMin = computeRectWallHeightFeet(5.5, 4);
  expect(
    approx(withMin.wallHeightFeet, 5) && approx(withMin.brickFeet, 0.5),
    'a 4" minimum brick drops the wall one 6" step',
  );
}

// T4: full height chain with top slab and attached base.
{
  console.log("T4: height chain");
  const r = computeRectStructure(input());
  // sump = 2" (T2); floor = 96 - 2/12; invertToTop = 4; raw = 4 - 0.5 - 8/12 + 2/12 = 3'
  expect(approx(r.sumpFeet, 2 / 12), 'sump 2"');
  expect(approx(r.rawAvailableFeet, 3), "raw available 3'");
  expect(approx(r.wallHeightFeet, 3), "wall height 3'");
  expect(approx(r.brickFeet, 0), "no brick needed");
  expect(approx(r.floorElevation, 96 - 2 / 12), "floor below invert by sump");
  expect(
    approx(r.totalHeightFeet, 3 + 8 / 12 + 0.5 + 8 / 12),
    "total = wall + top slab + casting + base slab",
  );
  expect(r.sections.length === 1, "defaults to a single pour");
  expect(r.errorMessage == null, "no error");

  const elevations = getRectStructureElevations(r);
  expect(
    elevations.some((entry) => entry.key === "top-slab-top"),
    "elevation ladder includes the top slab",
  );
}

// T5: no top slab, no base slab (open-bottom): floor is the bottom of walls.
{
  console.log("T5: open bottom, casting on walls");
  const r = computeRectStructure(
    input({ hasTopSlab: false, hasBaseSlab: false, topSlabOpening: null }),
  );
  expect(approx(r.topSlabThicknessFeet, 0), "no top slab thickness");
  expect(approx(r.baseSlabThicknessFeet, 0), "no base slab thickness");
  // raw = 4 - 0.5 - 0 + 2/12
  expect(approx(r.rawAvailableFeet, 3.6667, 1e-3), "walls absorb the slab space");
  expect(r.weights.topSlabLbs == null, "no top slab pick");
  expect(r.weights.baseSlabLbs == null, "no base pick");
  const elevations = getRectStructureElevations(r);
  expect(
    elevations.some((entry) => entry.label === "Bottom of Walls"),
    "floor labeled bottom of walls",
  );
}

// T6: manual splits, joint keys, per-section weights, joint-crossing warning.
{
  console.log("T6: manual sections");
  // invertToTop = 7.5; raw = 7.5 - 0.5 - 8/12 + 2/12 = 6.5'
  const r = computeRectStructure(
    input({
      rimElevation: 104,
      openings: [opening({ invertElevation: 96.5 })],
      sectionHeightsFeet: [3.5, 3],
      jointKeys: [true],
    }),
  );
  expect(approx(r.wallHeightFeet, 6.5), "wall height 6.5'");
  expect(r.sections.length === 2, "two manual sections");
  expect(
    r.sections[0].hasTopKey === true && r.sections[1].hasBottomKey === true,
    "joint key applies to both mating faces",
  );
  expect(
    r.sections[0].pickWeightLbs > r.sections[1].pickWeightLbs,
    "bottom section (with attached base) is heavier",
  );
  // Section weight sanity: 4'x4' inside, 6" walls -> shell area = 5x5-4x4 = 9 sqft.
  // Top section: 9 * 3 * 150 = 4050 lbs (no openings in it).
  expect(approx(r.sections[1].pickWeightLbs, 4050, 1), "top section weight 9sqft*3'*150");
  expect(r.weights.heaviestLbs === r.sections[0].pickWeightLbs, "heaviest pick reported");

  // The low opening pins the floor at 96.333'; the joint after a 3.5' bottom
  // section lands at 99.833'. A second opening centered near it must straddle.
  const crossing = computeRectStructure(
    input({
      rimElevation: 104,
      openings: [
        opening({ invertElevation: 96.5 }),
        opening({ label: "B", wall: "RIGHT", invertElevation: 99.6 }),
      ],
      sectionHeightsFeet: [3.5, 3],
      jointKeys: [false],
    }),
  );
  expect(
    crossing.warnings.some((w) => w.includes("crosses a section joint")),
    "warns when an opening straddles the joint",
  );
}

// T7: separate base is its own pick; top slab opening lightens the slab.
{
  console.log("T7: separate base + top slab weights");
  const r = computeRectStructure(input({ baseAttached: false }));
  const expectedBase = slabWeightLbs(4, 4, 0.5, 8 / 12);
  expect(
    r.weights.baseSlabLbs != null && approx(r.weights.baseSlabLbs, expectedBase, 1),
    "separate base weight = slab area x thickness x 150",
  );
  // 5x5 slab, 8" thick, minus 30"x30" opening: (25 - 6.25) * 2/3 * 150 = 1875
  expect(
    r.weights.topSlabLbs != null && approx(r.weights.topSlabLbs, 1875, 1),
    "top slab pick deducts its opening",
  );
  expect(CONCRETE_PCF === 150, "150 pcf");
}

// T8: horizontal placement math and too-wide warning.
{
  console.log("T8: horizontal placement");
  const r = computeRectStructure(
    input({
      openings: [
        opening({ label: "A", placement: "CENTERED" }),
        opening({ label: "B", wall: "RIGHT", placement: "TOUCH_LEFT" }),
        opening({
          label: "C",
          wall: "DOWN",
          placement: "FROM_LEFT",
          offsetInches: 12,
        }),
        opening({
          label: "D",
          wall: "LEFT",
          pipeMaterial: "RCP",
          pipeSizeInches: 18,
          widthOverrideInches: 60,
        }),
      ],
    }),
  );
  const [a, b, c, d] = r.openings;
  // Wall A is 48" inside; 18" opening centered -> 15..33.
  expect(approx(a.leftEdgeInches, 15) && approx(a.rightEdgeInches, 33), "centered opening");
  expect(approx(b.leftEdgeInches, 0), "touch-left pins to the wall end");
  // Centerline 12" from left, 18" wide -> 3..21.
  expect(approx(c.leftEdgeInches, 3) && approx(c.rightEdgeInches, 21), "dimensioned from left");
  expect(
    d.openingWidthInches === 60 && d.catalogWidthInches === 26,
    "manual skew override keeps catalog width for reference",
  );
  expect(
    r.warnings.some((w) => w.includes('wider than the Left wall')),
    "warns when the skewed opening exceeds the wall",
  );
}

// T9: pricing = wall (min height) + slab components (when present) + openings.
{
  console.log("T9: pricing");
  const r = computeRectStructure(input());
  // Wall 3' but 4' minimum at $100 -> $400; slabs $300 + $200; one $50 opening.
  expect(approx(r.wallPrice, 400), "minimum height pricing applied");
  expect(r.minPricingApplied, "minimum flag set");
  expect(approx(r.topSlabPrice, 300), "top slab component charged");
  expect(approx(r.baseSlabPrice, 200), "base slab component charged");
  expect(approx(r.openingsPrice, 50), "opening price from catalog");
  expect(approx(r.totalPrice, 950), "total = wall + slabs + openings");

  const openBottom = computeRectStructure(
    input({ hasTopSlab: false, hasBaseSlab: false, topSlabOpening: null }),
  );
  expect(
    approx(openBottom.topSlabPrice, 0) && approx(openBottom.baseSlabPrice, 0),
    "no slab charges without slabs",
  );

  const tall = computeRectStructure(
    input({ rimElevation: 106, openings: [opening({ invertElevation: 96 })] }),
  );
  expect(!tall.minPricingApplied, "no minimum once the wall exceeds it");
}

// T10: fixed sump mode.
{
  console.log("T10: fixed sump");
  const r = computeRectStructure(
    input({
      template: template({ sumpMode: "FIXED", sumpFixedInches: 24 }),
    }),
  );
  expect(approx(r.sumpFeet, 2), "fixed 24-inch sump");
  expect(approx(r.floorElevation, 94), "floor drops by the fixed sump");
}

if (failures > 0) {
  console.error(`\n${failures} rect structure check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll rect structure checks passed.");
