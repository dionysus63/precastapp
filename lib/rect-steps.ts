// Manhole steps (climbing rungs) on a rectangular structure.
//
// A structure picks one of twelve spots: three per wall, named by the plan
// view the way the sheet is read ("Up Left" = the Up wall, toward the left
// of the page). The distance from the inside corner to the middle of
// off-center steps is a template setting (rectStepsOffsetInches).

import type { RectWall } from "@/lib/rect-structure";

export const RECT_STEPS_POSITIONS = [
  "UP_LEFT",
  "UP_MIDDLE",
  "UP_RIGHT",
  "RIGHT_TOP",
  "RIGHT_MIDDLE",
  "RIGHT_BOTTOM",
  "DOWN_LEFT",
  "DOWN_MIDDLE",
  "DOWN_RIGHT",
  "LEFT_TOP",
  "LEFT_MIDDLE",
  "LEFT_BOTTOM",
] as const;

export type RectStepsPosition = (typeof RECT_STEPS_POSITIONS)[number];

export const RECT_STEPS_POSITION_LABELS: Record<RectStepsPosition, string> = {
  UP_LEFT: "Up Left",
  UP_MIDDLE: "Up Middle",
  UP_RIGHT: "Up Right",
  RIGHT_TOP: "Right Top",
  RIGHT_MIDDLE: "Right Middle",
  RIGHT_BOTTOM: "Right Bottom",
  DOWN_LEFT: "Down Left",
  DOWN_MIDDLE: "Down Middle",
  DOWN_RIGHT: "Down Right",
  LEFT_TOP: "Left Top",
  LEFT_MIDDLE: "Left Middle",
  LEFT_BOTTOM: "Left Bottom",
};

/** Dropdown options, in the order they run around the box. */
export const RECT_STEPS_POSITION_OPTIONS = RECT_STEPS_POSITIONS.map(
  (value) => ({ value, label: RECT_STEPS_POSITION_LABELS[value] }),
);

/** Width of one step, used to tell whether steps cross a pipe opening. */
export const RECT_STEP_WIDTH_INCHES = 14;
/** Rung spacing up the wall. The drawn rungs are a symbol, not a count. */
export const RECT_STEP_SPACING_INCHES = 12;

export function normalizeRectStepsPosition(
  value: unknown,
): RectStepsPosition | null {
  return typeof value === "string" &&
    (RECT_STEPS_POSITIONS as readonly string[]).includes(value)
    ? (value as RectStepsPosition)
    : null;
}

/**
 * Where a spot sits on its wall, in the terms pipe openings use: along the
 * wall from its LEFT inside face as seen from inside the box. The page and
 * that view agree on the Up wall only (see buildFlaps in
 * lib/rect-template-pdf.ts): the Down wall is mirrored, the Right wall runs
 * from the top of the page down, the Left wall from the bottom up.
 */
export function rectStepsPlacement(position: RectStepsPosition): {
  wall: RectWall;
  /** START = at the wall's left inside face, END = at its right. */
  along: "START" | "MIDDLE" | "END";
} {
  switch (position) {
    case "UP_LEFT":
      return { wall: "UP", along: "START" };
    case "UP_MIDDLE":
      return { wall: "UP", along: "MIDDLE" };
    case "UP_RIGHT":
      return { wall: "UP", along: "END" };
    case "RIGHT_TOP":
      return { wall: "RIGHT", along: "START" };
    case "RIGHT_MIDDLE":
      return { wall: "RIGHT", along: "MIDDLE" };
    case "RIGHT_BOTTOM":
      return { wall: "RIGHT", along: "END" };
    case "DOWN_LEFT":
      return { wall: "DOWN", along: "END" };
    case "DOWN_MIDDLE":
      return { wall: "DOWN", along: "MIDDLE" };
    case "DOWN_RIGHT":
      return { wall: "DOWN", along: "START" };
    case "LEFT_TOP":
      return { wall: "LEFT", along: "END" };
    case "LEFT_MIDDLE":
      return { wall: "LEFT", along: "MIDDLE" };
    case "LEFT_BOTTOM":
      return { wall: "LEFT", along: "START" };
  }
}
