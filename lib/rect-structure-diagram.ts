// Shared geometry for the rectangular structure sheet diagrams.
//
// All helpers return positions as FRACTIONS (0..1) of their containing box so
// the on-screen SVG (React) and the PDF overlay stay identical:
//   - elevation: fractions of the wall cavity (x across the inside width of
//     the drawn view, y up from the floor)
//   - plan: fractions of the inside rectangle (wall UP = top edge, RIGHT,
//     C = bottom, D = left)
//   - top slab: fractions of the slab outline (flush with the outside walls)
//
// Openings are NOT drawn to scale vertically (the sheets are schematic), but
// horizontal placement is honored: an opening that touches a wall end is
// drawn touching that end.

import type {
  ComputedRectOpening,
  RectStructureResult,
  RectWall,
} from "@/lib/rect-structure";

export type FractionRect = {
  /** Left edge, fraction of the container width. */
  x: number;
  /** Top edge, fraction of the container height (0 = top). */
  y: number;
  width: number;
  height: number;
};

const EPSILON = 1e-6;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Cumulative joint heights above the floor (feet), bottom-to-top, exclusive of the wall top. */
export function sectionJointHeightsFeet(
  result: RectStructureResult,
): { heightFromFloorFeet: number; keyed: boolean }[] {
  const joints: { heightFromFloorFeet: number; keyed: boolean }[] = [];
  let cursor = 0;
  for (let i = 0; i < result.sections.length - 1; i += 1) {
    cursor += result.sections[i].heightFeet;
    joints.push({
      heightFromFloorFeet: cursor,
      keyed: result.sections[i].hasTopKey,
    });
  }
  return joints;
}

/**
 * Elevation-view rectangle for an opening, as fractions of the wall cavity
 * (x across the drawn inside width, y measured from the TOP of the cavity).
 * Vertical position is true to the invert math; horizontal position uses the
 * opening's along-wall placement so touch-end openings hug the cavity edge.
 * Openings on walls B/D (side walls) still project onto the view at their
 * true elevation.
 */
export function elevationOpeningRect(
  opening: ComputedRectOpening,
  result: RectStructureResult,
): FractionRect | null {
  if (
    opening.bottomOfOpeningFeet == null ||
    opening.topOfOpeningFeet == null ||
    result.floorElevation == null ||
    result.wallHeightFeet <= EPSILON
  ) {
    return null;
  }
  const wallFeet = result.wallHeightFeet;
  const bottomFrac =
    (opening.bottomOfOpeningFeet - result.floorElevation) / wallFeet;
  const topFrac = (opening.topOfOpeningFeet - result.floorElevation) / wallFeet;

  const horizontal = planOpeningSpanFraction(opening, result);
  const x = horizontal?.startFraction ?? 0.4;
  const width = horizontal ? horizontal.endFraction - horizontal.startFraction : 0.2;

  return {
    x: clamp01(x),
    y: clamp01(1 - topFrac),
    width: clamp01(width),
    height: clamp01(topFrac - bottomFrac),
  };
}

/**
 * Along-wall span of an opening as fractions of its wall's inside run
 * (0 = left end looking at the wall from inside the plan, 1 = right end).
 */
export function planOpeningSpanFraction(
  opening: ComputedRectOpening,
  result: RectStructureResult,
): { startFraction: number; endFraction: number } | null {
  if (
    opening.wall == null ||
    opening.leftEdgeInches == null ||
    opening.rightEdgeInches == null ||
    result.insideLengthFeet == null ||
    result.insideWidthFeet == null
  ) {
    return null;
  }
  const runInches =
    (opening.wall === "UP" || opening.wall === "DOWN"
      ? result.insideLengthFeet
      : result.insideWidthFeet) * 12;
  if (runInches <= EPSILON) {
    return null;
  }
  return {
    startFraction: clamp01(opening.leftEdgeInches / runInches),
    endFraction: clamp01(opening.rightEdgeInches / runInches),
  };
}

/**
 * Plan-view rectangle for an opening drawn on its wall band, as fractions of
 * the INSIDE plan rectangle. The opening is drawn as a band of `bandFraction`
 * thickness sticking outward from the inside face (schematic wall depth).
 */
export function planOpeningRect(
  opening: ComputedRectOpening,
  result: RectStructureResult,
  bandFraction = 0.06,
): FractionRect | null {
  const span = planOpeningSpanFraction(opening, result);
  if (!span || opening.wall == null) {
    return null;
  }
  const length = span.endFraction - span.startFraction;
  switch (opening.wall) {
    case "UP": // top edge, left-to-right matches looking from inside
      return {
        x: span.startFraction,
        y: -bandFraction,
        width: length,
        height: bandFraction,
      };
    case "DOWN": // bottom edge; mirror so "left" stays the viewer's left
      return {
        x: 1 - span.endFraction,
        y: 1,
        width: length,
        height: bandFraction,
      };
    case "RIGHT": // right edge, top-to-bottom
      return {
        x: 1,
        y: span.startFraction,
        width: bandFraction,
        height: length,
      };
    case "LEFT": // left edge; mirror vertically
      return {
        x: -bandFraction,
        y: 1 - span.endFraction,
        width: bandFraction,
        height: length,
      };
    default:
      return null;
  }
}

/**
 * Top-slab opening rectangle as fractions of the slab outline (which is
 * flush with the outside walls). The opening touches the inside face of the
 * chosen wall side; the other axis is centered.
 */
export function topSlabOpeningRect(
  result: RectStructureResult,
): FractionRect | null {
  const opening = result.topSlabOpening;
  if (
    !result.hasTopSlab ||
    opening == null ||
    opening.lengthInches == null ||
    opening.widthInches == null ||
    result.outsideLengthFeet == null ||
    result.outsideWidthFeet == null
  ) {
    return null;
  }
  const slabLengthInches = result.outsideLengthFeet * 12;
  const slabWidthInches = result.outsideWidthFeet * 12;
  const wallInches = result.wallThicknessFeet * 12;
  if (slabLengthInches <= EPSILON || slabWidthInches <= EPSILON) {
    return null;
  }

  // Opening length runs along the slab length (plan L), width along plan W.
  const lengthFrac = clamp01(opening.lengthInches / slabLengthInches);
  const widthFrac = clamp01(opening.widthInches / slabWidthInches);
  const wallFracX = clamp01(wallInches / slabLengthInches);
  const wallFracY = clamp01(wallInches / slabWidthInches);

  const side: RectWall = opening.side ?? "UP";
  let x = (1 - lengthFrac) / 2;
  let y = (1 - widthFrac) / 2;
  switch (side) {
    case "UP": // touches inside of the top wall
      y = wallFracY;
      break;
    case "DOWN": // bottom wall
      y = 1 - wallFracY - widthFrac;
      break;
    case "LEFT": // left wall
      x = wallFracX;
      break;
    case "RIGHT": // right wall
      x = 1 - wallFracX - lengthFrac;
      break;
  }

  return {
    x: clamp01(x),
    y: clamp01(y),
    width: lengthFrac,
    height: widthFrac,
  };
}

/** Display label for a wall, e.g. "Wall A". */
export function wallLabel(wall: RectWall | null | undefined): string {
  if (!wall) {
    return "—";
  }
  const labels: Record<RectWall, string> = {
    UP: "Up wall",
    DOWN: "Down wall",
    LEFT: "Left wall",
    RIGHT: "Right wall",
  };
  return labels[wall];
}

/** Short placement description for the openings table / callouts. */
export function placementLabel(opening: ComputedRectOpening): string {
  switch (opening.placement) {
    case "TOUCH_LEFT":
      return "Touch left end";
    case "TOUCH_RIGHT":
      return "Touch right end";
    case "FROM_LEFT":
      return opening.offsetInches != null
        ? `${opening.offsetInches}" from left`
        : "From left";
    case "FROM_RIGHT":
      return opening.offsetInches != null
        ? `${opening.offsetInches}" from right`
        : "From right";
    case "CENTERED":
    default:
      return "Centered";
  }
}

/** Opening size text, e.g. `18"W x 16"H` (with skew note when widened). */
export function openingSizeLabel(opening: ComputedRectOpening): string {
  if (opening.openingWidthInches == null || opening.openingHeightInches == null) {
    return "—";
  }
  const skewed =
    opening.widthOverrideInches != null &&
    opening.catalogWidthInches != null &&
    Math.abs(opening.widthOverrideInches - opening.catalogWidthInches) > EPSILON;
  return `${opening.openingWidthInches}"W x ${opening.openingHeightInches}"H${skewed ? " (skew)" : ""}`;
}
