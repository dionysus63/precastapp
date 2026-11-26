import { describe, expect, it } from "vitest";
import {
  rectMoveDirections,
  rectMoveFromPlacement,
  rectMovePlacement,
  rectPlacementPageSide,
} from "@/lib/rect-opening-move";
import { computeRectStructure, type RectWall } from "@/lib/rect-structure";
import { planOpeningRect } from "@/lib/rect-structure-diagram";

// Moving a rect pipe opening off the center of its wall. The direction is
// picked the way the sheet is read; the opening is saved "from left" or
// "from right" as seen from inside the box, which only matches the page on
// the Up wall.

describe("which ways an opening can move", () => {
  it("offers left and right on the Up and Down walls, up and down on the sides", () => {
    expect(rectMoveDirections("UP")).toEqual(["LEFT", "RIGHT"]);
    expect(rectMoveDirections("DOWN")).toEqual(["LEFT", "RIGHT"]);
    expect(rectMoveDirections("LEFT")).toEqual(["UP", "DOWN"]);
    expect(rectMoveDirections("RIGHT")).toEqual(["UP", "DOWN"]);
  });
});

describe("a move as a saved placement", () => {
  it("measures from the inside face the opening moves toward", () => {
    // 48" wall, 6" off center: 18" from the closer face.
    expect(rectMovePlacement("UP", "LEFT", 6, 48)).toEqual({
      placement: "FROM_LEFT",
      offsetInches: 18,
    });
    expect(rectMovePlacement("UP", "RIGHT", 6, 48)).toEqual({
      placement: "FROM_RIGHT",
      offsetInches: 18,
    });
    // The Down wall is mirrored on the page.
    expect(rectMovePlacement("DOWN", "LEFT", 6, 48)?.placement).toBe("FROM_RIGHT");
    expect(rectMovePlacement("DOWN", "RIGHT", 6, 48)?.placement).toBe("FROM_LEFT");
    // The Right wall runs from the top of the page down, the Left wall up.
    expect(rectMovePlacement("RIGHT", "UP", 6, 48)?.placement).toBe("FROM_LEFT");
    expect(rectMovePlacement("RIGHT", "DOWN", 6, 48)?.placement).toBe("FROM_RIGHT");
    expect(rectMovePlacement("LEFT", "UP", 6, 48)?.placement).toBe("FROM_RIGHT");
    expect(rectMovePlacement("LEFT", "DOWN", 6, 48)?.placement).toBe("FROM_LEFT");
  });

  it("keeps a half inch when the wall is an odd number of inches long", () => {
    expect(rectMovePlacement("UP", "LEFT", 6, 45)?.offsetInches).toBe(16.5);
    // 3.6667' saved for a 44" wall is a hair over 44".
    expect(rectMovePlacement("UP", "LEFT", 6, 3.6667 * 12)?.offsetInches).toBe(16);
  });

  it("has no answer for a direction the wall does not have", () => {
    expect(rectMovePlacement("UP", "DOWN", 6, 48)).toBeNull();
    expect(rectMovePlacement("LEFT", "RIGHT", 6, 48)).toBeNull();
    expect(rectMovePlacement("UP", "LEFT", 6, 0)).toBeNull();
  });

  it("reads back as the same move on every wall", () => {
    const walls: RectWall[] = ["UP", "DOWN", "LEFT", "RIGHT"];
    for (const wall of walls) {
      for (const direction of rectMoveDirections(wall)) {
        const saved = rectMovePlacement(wall, direction, 7, 60);
        expect(saved).not.toBeNull();
        expect(
          rectMoveFromPlacement(wall, saved!.placement, saved!.offsetInches, 60),
        ).toEqual({ direction, inches: 7 });
      }
    }
  });

  it("reads a distance from the far face as a move the other way", () => {
    // 30" from the left of a 48" wall is 6" right of the middle.
    expect(rectMoveFromPlacement("UP", "FROM_LEFT", 30, 48)).toEqual({
      direction: "RIGHT",
      inches: 6,
    });
  });

  it("is no move in the middle of the wall, or for other placements", () => {
    expect(rectMoveFromPlacement("UP", "FROM_LEFT", 24, 48)).toBeNull();
    expect(rectMoveFromPlacement("UP", "CENTERED", null, 48)).toBeNull();
    expect(rectMoveFromPlacement("UP", "TOUCH_LEFT", null, 48)).toBeNull();
    expect(rectMoveFromPlacement("UP", "FROM_LEFT", null, 48)).toBeNull();
  });
});

describe("a move on the plan", () => {
  const TEMPLATE = {
    wallThicknessInches: 8,
    baseSlabThicknessInches: 8,
    topSlabThicknessInches: 8,
    minimumBrickInches: 3,
    sumpMode: "FIXED" as const,
    sumpFixedInches: 24,
    wallPricePerFoot: 0,
    minPricingHeightFeet: 0,
    topSlabPrice: 0,
    baseSlabPrice: 0,
  };

  // Where the opening's middle lands on the plan (x across, y down the
  // page, as fractions of the inside box), for a move on each wall.
  function planCenter(wall: RectWall, direction: "LEFT" | "RIGHT" | "UP" | "DOWN") {
    const saved = rectMovePlacement(wall, direction, 6, 48)!;
    const result = computeRectStructure({
      rimElevation: 103.4,
      castingHeightFeet: 0.42,
      insideLengthFeet: 4,
      insideWidthFeet: 4,
      baseAttached: true,
      template: TEMPLATE,
      openingSizes: [
        {
          pipeMaterial: "HDPE",
          pipeSizeInches: 15,
          openingWidthInches: 24,
          openingHeightInches: 24,
          pipeWallThicknessInches: 1.5,
          pricePerOpening: null,
        },
      ],
      openings: [
        {
          label: "A",
          wall,
          pipeMaterial: "HDPE",
          pipeSizeInches: 15,
          invertElevation: 99.5,
          placement: saved.placement,
          offsetInches: saved.offsetInches,
          widthOverrideInches: null,
        },
      ],
      sectionHeightsFeet: [],
      jointKeys: [],
      topSlabOpening: null,
    });
    const rect = planOpeningRect(result.openings[0], result)!;
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }

  it("goes the way it says on the page", () => {
    expect(planCenter("UP", "LEFT").x).toBeCloseTo(18 / 48);
    expect(planCenter("UP", "RIGHT").x).toBeCloseTo(30 / 48);
    expect(planCenter("DOWN", "LEFT").x).toBeCloseTo(18 / 48);
    expect(planCenter("DOWN", "RIGHT").x).toBeCloseTo(30 / 48);
    expect(planCenter("LEFT", "UP").y).toBeCloseTo(18 / 48);
    expect(planCenter("LEFT", "DOWN").y).toBeCloseTo(30 / 48);
    expect(planCenter("RIGHT", "UP").y).toBeCloseTo(18 / 48);
    expect(planCenter("RIGHT", "DOWN").y).toBeCloseTo(30 / 48);
  });
});

describe("the wall end a placement is measured from, as the page shows it", () => {
  it("names the side of the page", () => {
    expect(rectPlacementPageSide("UP", "FROM_LEFT")).toBe("LEFT");
    expect(rectPlacementPageSide("UP", "FROM_RIGHT")).toBe("RIGHT");
    expect(rectPlacementPageSide("DOWN", "FROM_LEFT")).toBe("RIGHT");
    expect(rectPlacementPageSide("DOWN", "FROM_RIGHT")).toBe("LEFT");
    expect(rectPlacementPageSide("RIGHT", "FROM_LEFT")).toBe("TOP");
    expect(rectPlacementPageSide("RIGHT", "FROM_RIGHT")).toBe("BOTTOM");
    expect(rectPlacementPageSide("LEFT", "FROM_LEFT")).toBe("BOTTOM");
    expect(rectPlacementPageSide("LEFT", "FROM_RIGHT")).toBe("TOP");
  });
});
