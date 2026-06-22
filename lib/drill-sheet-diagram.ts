// Shared plan-view geometry for the circular drill sheet diagram.
//
// The lowest-invert (outlet) opening is always drawn pointing UP (12 o'clock).
// Other openings are placed by their angle measured clockwise from the outlet:
//   0 = up, 90 = right, 180 = down, 270 = left.
//
// Used by both the on-screen SVG (React) and the PDF HTML so they stay identical.

import type { ComputedOpening, DrillSheetResult } from "@/lib/drill-sheet";

export type OpeningPlacement = {
  label: string;
  pipeType: string | null;
  pipeDiameterInches: number | null;
  holeDiameterInches: number | null;
  isLowInvert: boolean;
  angleDeg: number;
  x: number;
  y: number;
};

export type DiagramLayout = {
  cx: number;
  cy: number;
  radius: number;
};

/** Converts a clockwise-from-up angle (degrees) to an x/y point on a circle. */
export function polarToXY(
  angleDeg: number,
  radius: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.sin(radians),
    y: cy - radius * Math.cos(radians),
  };
}

/**
 * Places openings around the structure circle. The outlet (lowest invert) is
 * forced to 0 degrees (straight up); all other openings use their entered angle.
 */
export function getOpeningPlacements(
  openings: ComputedOpening[],
  layout: DiagramLayout,
): OpeningPlacement[] {
  return openings.map((opening, index) => {
    const angleDeg = opening.isLowInvert ? 0 : (opening.angleDegrees ?? 0);
    const { x, y } = polarToXY(angleDeg, layout.radius, layout.cx, layout.cy);
    return {
      label: opening.label?.trim() || String.fromCharCode(65 + index),
      pipeType: opening.pipeType ?? null,
      pipeDiameterInches: opening.pipeDiameterInches,
      holeDiameterInches: opening.holeDiameterInches,
      isLowInvert: opening.isLowInvert,
      angleDeg,
      x,
      y,
    };
  });
}

/** Normalizes a degree value into the [0, 360) range. */
export function normalizeDegrees(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

/** Formats a clockwise-from-up angle as an approximate clock position (e.g. 3:00). */
export function angleToClockPosition(angleDeg: number): string {
  const normalized = normalizeDegrees(angleDeg);
  // 360 degrees / 12 hours = 30 degrees per hour; round to the nearest 30 min.
  const totalHalfHours = Math.round(normalized / 15) % 24;
  let hour = Math.floor(totalHalfHours / 2);
  const minutes = totalHalfHours % 2 === 0 ? "00" : "30";
  if (hour === 0) {
    hour = 12;
  }
  return `${hour}:${minutes}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export type OpeningCallout = {
  /** Pipe head label, e.g. "PVC  Yes  8"". */
  headLabel: string;
  /** Invert elevation formatted to 2 decimals, e.g. "76.70". */
  invertLabel: string;
  /** Boot hole label, e.g. `12"Ø @ Bottom` or `12"Ø @ +1"`. */
  holeLabel: string;
};

/**
 * Builds the leader-line callout text for an opening in the plan view. The
 * lowest invert reads `@ Bottom`; raised inverts read `@ +N"` where N is the
 * rise above the low invert in whole inches.
 */
export function getOpeningCallout(
  opening: ComputedOpening,
  lowInvertElevation: number | null,
): OpeningCallout {
  const diaText =
    opening.pipeDiameterInches != null ? `${opening.pipeDiameterInches}"` : "";
  const boot = opening.hasBoot ? "Yes" : "No";
  const typeText = opening.pipeType?.trim() || "";
  const headLabel = [typeText, boot, diaText].filter(Boolean).join("  ");

  const invertLabel =
    opening.invertElevation != null ? opening.invertElevation.toFixed(2) : "";

  const holePrefix =
    opening.holeDiameterInches != null ? `${opening.holeDiameterInches}"Ø` : "";

  let holeSuffix = "";
  if (opening.invertElevation != null && lowInvertElevation != null) {
    const raisedInches = Math.round(
      (opening.invertElevation - lowInvertElevation) * 12,
    );
    holeSuffix = raisedInches <= 0 ? "@ Bottom" : `@ +${raisedInches}"`;
  } else if (opening.isLowInvert) {
    holeSuffix = "@ Bottom";
  }

  const holeLabel = [holePrefix, holeSuffix].filter(Boolean).join(" ");

  return { headLabel, invertLabel, holeLabel };
}

export type ElevationBand = {
  key: "CASTING" | "BRICK" | "TOPSLAB" | "RISER" | "BASE";
  label: string;
  heightFeet: number;
};

export type ElevationBreakdown = {
  /** Stacked bands from top (casting) to bottom (base). */
  bands: ElevationBand[];
  totalFeet: number;
  /** Nominal base-slab thickness (not stored in the data model; drawn detail). */
  baseSlabFeet: number;
  elevations: {
    rim: number | null;
    topOfBrick: number | null;
    topOfSlab: number | null;
    topOfWall: number | null;
    floor: number | null;
    baseBottom: number | null;
  };
};

/** Nominal base-slab thickness in feet (8") used only for the drawn detail. */
export const NOMINAL_BASE_SLAB_FEET = 8 / 12;

/**
 * Decomposes a computed drill sheet into the vertical bands and boundary
 * elevations used to draw the side elevation. Bands are ordered top to bottom:
 * casting, brick, top slab, risers, then base.
 */
export function getElevationBreakdown(
  result: DrillSheetResult,
): ElevationBreakdown {
  const risers = result.sections.filter((section) => section.role === "RISER");
  const bases = result.sections.filter((section) => section.role === "BASE");

  const bands: ElevationBand[] = [];
  if (result.castingHeightFeet > 0) {
    bands.push({
      key: "CASTING",
      label: "Casting",
      heightFeet: result.castingHeightFeet,
    });
  }
  if (result.brickAdjustmentFeet > 0) {
    bands.push({
      key: "BRICK",
      label: "Brick",
      heightFeet: result.brickAdjustmentFeet,
    });
  }
  if (result.topSlabHeightFeet > 0) {
    bands.push({
      key: "TOPSLAB",
      label: "Top Slab",
      heightFeet: result.topSlabHeightFeet,
    });
  }
  for (const riser of risers) {
    bands.push({ key: "RISER", label: "Riser", heightFeet: riser.heightFeet });
  }
  for (const base of bases) {
    bands.push({
      key: "BASE",
      label: "Base Section",
      heightFeet: base.heightFeet,
    });
  }

  const totalFeet = bands.reduce((sum, band) => sum + band.heightFeet, 0);

  const rim = result.rimElevation;
  const topOfBrick = rim != null ? round2(rim - result.castingHeightFeet) : null;
  const topOfSlab =
    topOfBrick != null ? round2(topOfBrick - result.brickAdjustmentFeet) : null;
  const topOfWall =
    topOfSlab != null ? round2(topOfSlab - result.topSlabHeightFeet) : null;
  const floor =
    result.lowInvertElevation != null
      ? round2(result.lowInvertElevation - result.sumpFeet)
      : null;
  const baseSlabFeet = NOMINAL_BASE_SLAB_FEET;
  const baseBottom = floor != null ? round2(floor - baseSlabFeet) : null;

  return {
    bands,
    totalFeet,
    baseSlabFeet,
    elevations: { rim, topOfBrick, topOfSlab, topOfWall, floor, baseBottom },
  };
}

export type SpokeSegment = { x1: number; y1: number; x2: number; y2: number };

/**
 * Knockout indicator marks crossing the structure wall at evenly spaced angles
 * (default every 45deg). Each spoke runs from just inside to just outside the
 * wall, matching the radial tick marks on the example circles.
 */
export function getKnockoutSpokes(
  layout: DiagramLayout,
  count = 8,
  inset = 14,
  outset = 14,
): SpokeSegment[] {
  const spokes: SpokeSegment[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (360 / count) * i;
    const inner = polarToXY(angle, layout.radius - inset, layout.cx, layout.cy);
    const outer = polarToXY(angle, layout.radius + outset, layout.cx, layout.cy);
    spokes.push({ x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y });
  }
  return spokes;
}

export type BootSymbol = {
  /** Center of the boot glyph, on the wall at the opening angle. */
  center: { x: number; y: number };
  /** Inner point of the radial arrow (toward the circle center). */
  arrowTail: { x: number; y: number };
  /** Outward arrow tip (points away from the structure). */
  arrowTip: { x: number; y: number };
  /** Center of the lettered badge circle, just outside the wall. */
  badge: { x: number; y: number };
  /** Bowtie glyph corner points (two triangles meeting at center). */
  bowtie: { x: number; y: number }[];
  /** Perpendicular unit vector along the wall tangent (for sizing the glyph). */
  tangent: { x: number; y: number };
  /** Radial unit vector pointing outward. */
  radial: { x: number; y: number };
};

/**
 * Geometry for the bowtie boot glyph + outward arrow + lettered badge drawn at
 * an opening on the BASE circle. The glyph straddles the wall at the opening
 * angle; the arrow points radially outward.
 */
export function getBootSymbol(
  placement: OpeningPlacement,
  layout: DiagramLayout,
  glyphHalf = 7,
): BootSymbol {
  const angle = placement.angleDeg;
  const radians = (angle * Math.PI) / 180;
  // Outward radial unit vector (matches polarToXY's up-is-zero convention).
  const radial = { x: Math.sin(radians), y: -Math.cos(radians) };
  // Tangent (perpendicular) unit vector along the wall.
  const tangent = { x: -radial.y, y: radial.x };

  const center = { x: placement.x, y: placement.y };
  const arrowTail = polarToXY(angle, layout.radius - 6, layout.cx, layout.cy);
  const arrowTip = polarToXY(angle, layout.radius + 26, layout.cx, layout.cy);
  const badge = polarToXY(angle, layout.radius + 20, layout.cx, layout.cy);

  // Bowtie: two triangles meeting at center, opening along the tangent and
  // spanning the wall along the radial direction.
  const t = (s: number) => ({ x: tangent.x * s, y: tangent.y * s });
  const r = (s: number) => ({ x: radial.x * s, y: radial.y * s });
  const corner = (rs: number, ts: number) => ({
    x: center.x + r(rs).x + t(ts).x,
    y: center.y + r(rs).y + t(ts).y,
  });
  const bowtie = [
    corner(-glyphHalf, -glyphHalf),
    corner(-glyphHalf, glyphHalf),
    corner(glyphHalf, -glyphHalf),
    corner(glyphHalf, glyphHalf),
  ];

  return { center, arrowTail, arrowTip, badge, bowtie, tangent, radial };
}
