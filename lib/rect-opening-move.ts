// Moving a rectangular pipe opening off the center of its wall.
//
// Quick Build's "Move" special takes a direction as the sheet is read (Left
// or Right on the Up and Down walls, Up or Down on the Left and Right walls)
// and a distance in inches. An opening's place along its wall is saved the
// way the rest of the app already saves it: FROM_LEFT / FROM_RIGHT with the
// distance from that inside face to the opening's centerline, where "left"
// is the wall's left end as seen from inside the box. The page and that view
// only agree on the Up wall (see buildFlaps in lib/rect-template-pdf.ts), so
// everything that turns one into the other lives here.

import type { RectOpeningPlacement, RectWall } from "@/lib/rect-structure";

export const RECT_MOVE_DIRECTIONS = ["LEFT", "RIGHT", "UP", "DOWN"] as const;

export type RectMoveDirection = (typeof RECT_MOVE_DIRECTIONS)[number];

export const RECT_MOVE_DIRECTION_LABELS: Record<RectMoveDirection, string> = {
  LEFT: "Left",
  RIGHT: "Right",
  UP: "Up",
  DOWN: "Down",
};

export function isRectMoveDirection(value: unknown): value is RectMoveDirection {
  return (
    typeof value === "string" &&
    (RECT_MOVE_DIRECTIONS as readonly string[]).includes(value)
  );
}

/** The two ways an opening on this wall can move, as the sheet is read. */
export function rectMoveDirections(wall: RectWall): RectMoveDirection[] {
  return wall === "UP" || wall === "DOWN" ? ["LEFT", "RIGHT"] : ["UP", "DOWN"];
}

/** START = the wall's left inside face (seen from inside), END = its right. */
type WallEnd = "START" | "END";

/** Which end of each wall sits toward which side of the page. */
const WALL_END_TOWARD: Record<
  RectWall,
  Partial<Record<RectMoveDirection, WallEnd>>
> = {
  UP: { LEFT: "START", RIGHT: "END" },
  DOWN: { LEFT: "END", RIGHT: "START" },
  RIGHT: { UP: "START", DOWN: "END" },
  LEFT: { UP: "END", DOWN: "START" },
};

function directionToward(wall: RectWall, end: WallEnd): RectMoveDirection {
  const found = rectMoveDirections(wall).find(
    (direction) => WALL_END_TOWARD[wall][direction] === end,
  );
  // Every wall lists both of its ends above.
  return found ?? rectMoveDirections(wall)[0];
}

/** Hundredths of an inch, the precision an opening's offset is saved at. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The saved placement for an opening moved `inches` off center toward
 * `direction`: measured from the inside face it moves toward, which is the
 * closer one. Null when the direction does not belong to the wall or the
 * wall has no length.
 */
export function rectMovePlacement(
  wall: RectWall,
  direction: RectMoveDirection,
  inches: number,
  wallRunInches: number,
): { placement: RectOpeningPlacement; offsetInches: number } | null {
  const end = WALL_END_TOWARD[wall][direction];
  if (!end || !(wallRunInches > 0) || !Number.isFinite(inches)) {
    return null;
  }
  return {
    placement: end === "START" ? "FROM_LEFT" : "FROM_RIGHT",
    offsetInches: round2(wallRunInches / 2 - inches),
  };
}

/**
 * The move a saved placement amounts to: which way off center, as the sheet
 * is read, and how far. Null for an opening in the middle of its wall, or
 * one placed some other way (centered, or touching a wall end).
 */
export function rectMoveFromPlacement(
  wall: RectWall,
  placement: RectOpeningPlacement,
  offsetInches: number | null,
  wallRunInches: number,
): { direction: RectMoveDirection; inches: number } | null {
  if (
    (placement !== "FROM_LEFT" && placement !== "FROM_RIGHT") ||
    offsetInches == null ||
    !Number.isFinite(offsetInches) ||
    !(wallRunInches > 0)
  ) {
    return null;
  }
  // Positive = toward the face the placement is measured from.
  const towardReference = round2(wallRunInches / 2 - offsetInches);
  if (towardReference === 0) {
    return null;
  }
  const reference: WallEnd = placement === "FROM_LEFT" ? "START" : "END";
  const other: WallEnd = reference === "START" ? "END" : "START";
  return {
    direction: directionToward(wall, towardReference > 0 ? reference : other),
    inches: Math.abs(towardReference),
  };
}

/**
 * The side of the page a FROM_LEFT / FROM_RIGHT placement is measured from,
 * for wording on the printed sheet ("18\" FROM TOP").
 */
export function rectPlacementPageSide(
  wall: RectWall,
  placement: "FROM_LEFT" | "FROM_RIGHT",
): "LEFT" | "RIGHT" | "TOP" | "BOTTOM" {
  const direction = directionToward(
    wall,
    placement === "FROM_LEFT" ? "START" : "END",
  );
  switch (direction) {
    case "UP":
      return "TOP";
    case "DOWN":
      return "BOTTOM";
    default:
      return direction;
  }
}
