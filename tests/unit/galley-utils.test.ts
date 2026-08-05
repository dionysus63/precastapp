import { describe, expect, it } from "vitest";
import {
  GALLEY_TYPE_ORDER,
  isGalleyFamilyOptionId,
  makeGalleyFamilyOptionId,
  stripGalleyTypeSuffix,
  validateGalleyBreakdownCounts,
  type GalleyTypeValue,
} from "@/lib/galley-utils";

const ALL_TYPES: GalleyTypeValue[] = ["END", "MIDDLE", "CB"];

describe("stripGalleyTypeSuffix", () => {
  it("strips each type suffix from real catalog names", () => {
    expect(
      stripGalleyTypeSuffix('Storm Leaching Galley - 4\'-0"  - One End'),
    ).toBe('Storm Leaching Galley - 4\'-0"');
    expect(
      stripGalleyTypeSuffix('Storm Leaching Galley - 4\'-0"  - Middle'),
    ).toBe('Storm Leaching Galley - 4\'-0"');
    expect(stripGalleyTypeSuffix('Storm Leaching Galley - 2\'6"  - CB')).toBe(
      'Storm Leaching Galley - 2\'6"',
    );
  });

  it("keeps open-top names intact apart from the type", () => {
    expect(
      stripGalleyTypeSuffix(
        'Storm Leaching Galley - 5\'-0"  Open Top - One End',
      ),
    ).toBe('Storm Leaching Galley - 5\'-0"  Open Top');
  });

  it("returns non-galley names unchanged", () => {
    expect(stripGalleyTypeSuffix('San Leaching Galley - 1\'-0"')).toBe(
      'San Leaching Galley - 1\'-0"',
    );
  });
});

describe("galley family option ids", () => {
  it("round-trips and never collides with product ids", () => {
    const id = makeGalleyFamilyOptionId("LGD-40");
    expect(isGalleyFamilyOptionId(id)).toBe(true);
    expect(isGalleyFamilyOptionId("cku3x9000000abcd")).toBe(false);
  });
});

describe("validateGalleyBreakdownCounts", () => {
  it("accepts a split that sums to the total", () => {
    expect(
      validateGalleyBreakdownCounts(
        { END: 4, MIDDLE: 14, CB: 2 },
        20,
        ALL_TYPES,
      ),
    ).toBeNull();
  });

  it("accepts zero counts for unused types", () => {
    expect(
      validateGalleyBreakdownCounts({ END: 2, MIDDLE: 6, CB: 0 }, 8, ALL_TYPES),
    ).toBeNull();
  });

  it("rejects a sum mismatch", () => {
    expect(
      validateGalleyBreakdownCounts(
        { END: 2, MIDDLE: 10, CB: 2 },
        20,
        ALL_TYPES,
      ),
    ).toMatch(/add up to the quoted total of 20/);
  });

  it("rejects negative and fractional counts", () => {
    expect(
      validateGalleyBreakdownCounts(
        { END: -1, MIDDLE: 21, CB: 0 },
        20,
        ALL_TYPES,
      ),
    ).toMatch(/whole number/);
    expect(
      validateGalleyBreakdownCounts(
        { END: 0.5, MIDDLE: 19.5, CB: 0 },
        20,
        ALL_TYPES,
      ),
    ).toMatch(/whole number/);
  });

  it("rejects counts for types the family does not offer", () => {
    expect(
      validateGalleyBreakdownCounts({ END: 2, MIDDLE: 16, CB: 2 }, 20, [
        "END",
        "MIDDLE",
      ]),
    ).toMatch(/No active CB product/);
  });

  it("rejects a non-integer quoted total", () => {
    expect(
      validateGalleyBreakdownCounts(
        { END: 2, MIDDLE: 2, CB: 0 },
        4.5,
        ALL_TYPES,
      ),
    ).toMatch(/whole number/);
  });
});

describe("GALLEY_TYPE_ORDER", () => {
  it("orders ends before middles before CB", () => {
    expect(GALLEY_TYPE_ORDER).toEqual(["END", "MIDDLE", "CB"]);
  });
});
