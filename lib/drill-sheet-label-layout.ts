/**
 * Label placement for the penetration arrows on a circular drill sheet's
 * plan circle. Every inlet arrow carries two labels outside the wall: the
 * circled letter badge and the hole-size callout (`12"Ø` over `@ +5"`).
 * Normally the badge sits on one side of the shaft and the callout on the
 * other. When pipes are close together those labels land on a neighbor's
 * labels or shaft, so this module picks, for each arrow, one of four
 * arrangements such that nothing overlaps while changing as little as
 * possible from the normal look.
 *
 * All geometry is in template reference points (the AutoCAD template draws
 * the plan circle at a radius of 87 pt), in a frame centered on the circle
 * with y up and angles measured clockwise from the top. The PDF fill scales
 * the result by the real marker radius.
 */

// Penetration-arrow geometry (PDF points), measured from the outlet arrow's
// vector line work in the AutoCAD template (drawn on a circle of radius
// 87 pt with a 13.5 pt wall band) so generated arrows are indistinguishable
// from it. The template outlet arrow points outward (up): a 0.3 pt shaft
// running from 27.9 pt past the inner circle to 27.9 pt past the outer
// circle, a solid triangular head 7.6 pt long by 10.6 pt wide with 0.3 pt
// stroked edges at the tip, and the opening letter (~15 pt) inside a
// stroked 8 pt-radius circle centered 13.5 pt outside the wall and 17.8 pt
// to the right of the shaft. Where the shaft crosses the wall, an X glyph
// spans the band: two lines parallel to the shaft offset +/-13.9 pt with
// diagonals joining opposite corners. Penetration arrows are that arrow
// rotated to point inward: tail 27.9 pt outside the outer circle, tip
// 27.9 pt inside the inner circle pointing at the center, letter badge
// outside beside the shaft. All lengths scale with the plan_circle marker
// radius.
export const REFERENCE_RADIUS_PT = 87;
export const WALL_BAND_PT = 13.5;
export const ARROW_OVERSHOOT_PT = 27.9;
// X boot glyph, measured: side lines at +/-13.9 pt from the shaft, spanning
// radius offsets -15.2 to -1.1 from the outer circle, ~0.5 pt strokes.
export const GLYPH_HALF_WIDTH_PT = 13.9;
export const GLYPH_INNER_OFFSET_PT = 15.2;
export const GLYPH_OUTER_OFFSET_PT = 1.1;
export const BADGE_RADIUS_PT = 8;
export const BADGE_RADIAL_OUTSIDE_PT = 13.5;
export const BADGE_TANGENT_OFFSET_PT = 17.8;
/** Half of Helvetica's cap height, used to vertically center text. */
export const HALF_CAP_HEIGHT_RATIO = 0.36;
// Hole-size callout next to each arrow: `12"Ø` over `@+5"`, center-aligned,
// normally on the opposite tangent side of the shaft from the letter badge.
// The low-invert (outlet) callout is a single line centered above the
// template's up arrow instead.
export const CALLOUT_FONT_SIZE_PT = 11;
export const CALLOUT_LINE_GAP_PT = 3;
export const CALLOUT_RADIAL_OUTSIDE_PT = 20;
export const CALLOUT_TANGENT_OFFSET_PT = 27;
export const CALLOUT_ABOVE_TIP_GAP_PT = 4;
// White background mask behind callout text (AutoCAD-style text mask) so the
// template's knockout spokes visually break behind the text.
export const CALLOUT_MASK_PADDING_PT = 2;

/** Smallest gap kept between a callout's mask and its own arrow shaft. */
const CALLOUT_SHAFT_GAP_PT = 4;
/** Gap between the badge and a callout stacked beyond it on the same side. */
const CALLOUT_BADGE_GAP_PT = 3;
/** Labels closer than this to another label or arrow count as overlapping. */
const LABEL_CLEARANCE_PT = 2.5;

/** +1 is the template badge side: right of the shaft on an arrow pointing up. */
export type LabelSide = 1 | -1;

export type PenetrationLabelPlacement = {
  /** Which side of the shaft the circled letter sits on. */
  badgeSide: LabelSide;
  /** Which side of the shaft the hole-size callout sits on. */
  calloutSide: LabelSide;
  /** Distance from the shaft to the callout block center, along the tangent. */
  calloutTangentOffsetPt: number;
};

export type PenetrationLabelInput = {
  /** Clockwise from the top of the circle; the outlet sits at 0. */
  angleDegrees: number;
  /** Callout lines' widths at CALLOUT_FONT_SIZE_PT; empty when no callout. */
  calloutLineWidthsPt: number[];
};

export type PenetrationLabelLayoutInput = {
  inlets: PenetrationLabelInput[];
  /**
   * The template's static outlet arrow and "A" badge at the top of the
   * circle, plus the one-line callout the fill prints above its tip (null
   * when no outlet callout is printed). Omit on circles without the
   * artwork (the riser circle).
   */
  outlet?: { calloutWidthPt: number | null };
};

type Point = { x: number; y: number };
type Box = { cx: number; cy: number; halfWidth: number; halfHeight: number };
type Circle = { cx: number; cy: number; radius: number };
type Segment = { a: Point; b: Point };

type Labels = { badge: Circle; callout: Box | null };
type Candidate = {
  placement: PenetrationLabelPlacement;
  labels: Labels;
  /** Preference cost: 0 for the normal arrangement, more the further from it. */
  cost: number;
};

// One real overlap outweighs any amount of crowding, and crowding outweighs
// any preference for the normal arrangement.
const OVERLAP_COST = 10000;
const TIGHT_COST = 20;

export function outwardRadialUnit(angleDeg: number): Point {
  const radians = (angleDeg * Math.PI) / 180;
  return { x: Math.sin(radians), y: Math.cos(radians) };
}

/** Unit tangent toward the template badge side of an arrow at this angle. */
export function badgeSideTangentUnit(angleDeg: number): Point {
  const radial = outwardRadialUnit(angleDeg);
  return { x: radial.y, y: -radial.x };
}

/** Vertical distance between the baselines of a callout's stacked lines. */
export function calloutLineHeight(fontSize: number, scale: number): number {
  return fontSize * (2 * HALF_CAP_HEIGHT_RATIO) + CALLOUT_LINE_GAP_PT * scale;
}

/**
 * Half extents of a callout's mask box (text plus padding) around the block
 * center, in reference points. The mask reaches a little further below the
 * center than above it (descender room); the taller half is used for both.
 */
function calloutHalfExtents(lineWidthsPt: number[]): {
  halfWidth: number;
  halfHeight: number;
} {
  const fontSize = CALLOUT_FONT_SIZE_PT;
  const blockHeight =
    calloutLineHeight(fontSize, 1) * (lineWidthsPt.length - 1);
  return {
    halfWidth: Math.max(...lineWidthsPt) / 2 + CALLOUT_MASK_PADDING_PT,
    halfHeight:
      blockHeight / 2 +
      fontSize * (0.25 + HALF_CAP_HEIGHT_RATIO) +
      CALLOUT_MASK_PADDING_PT,
  };
}

function polar(angleDeg: number, radial: number, tangent: number): Point {
  const r = outwardRadialUnit(angleDeg);
  const t = badgeSideTangentUnit(angleDeg);
  return {
    x: r.x * radial + t.x * tangent,
    y: r.y * radial + t.y * tangent,
  };
}

function badgeCircle(angleDeg: number, side: LabelSide): Circle {
  const center = polar(
    angleDeg,
    REFERENCE_RADIUS_PT + BADGE_RADIAL_OUTSIDE_PT,
    side * BADGE_TANGENT_OFFSET_PT,
  );
  return { cx: center.x, cy: center.y, radius: BADGE_RADIUS_PT };
}

/** How far a callout's (unrotated) mask box reaches along the arrow's tangent. */
function calloutTangentReach(inlet: PenetrationLabelInput): number {
  if (inlet.calloutLineWidthsPt.length === 0) {
    return 0;
  }
  const extents = calloutHalfExtents(inlet.calloutLineWidthsPt);
  const tangent = badgeSideTangentUnit(inlet.angleDegrees);
  return (
    Math.abs(tangent.x) * extents.halfWidth +
    Math.abs(tangent.y) * extents.halfHeight
  );
}

/** The shapes an arrow's two labels occupy under a placement. */
function labelsFor(
  inlet: PenetrationLabelInput,
  placement: PenetrationLabelPlacement,
): Labels {
  let callout: Box | null = null;
  if (inlet.calloutLineWidthsPt.length > 0) {
    const center = polar(
      inlet.angleDegrees,
      REFERENCE_RADIUS_PT + CALLOUT_RADIAL_OUTSIDE_PT,
      placement.calloutSide * placement.calloutTangentOffsetPt,
    );
    callout = {
      cx: center.x,
      cy: center.y,
      ...calloutHalfExtents(inlet.calloutLineWidthsPt),
    };
  }
  return {
    badge: badgeCircle(inlet.angleDegrees, placement.badgeSide),
    callout,
  };
}

/**
 * The normal arrangement: badge on the template side of the shaft, callout
 * beside the shaft on the other side. Long callout text moves out just far
 * enough that its mask clears the shaft.
 */
export function defaultPenetrationLabelPlacement(
  inlet: PenetrationLabelInput,
): PenetrationLabelPlacement {
  return {
    badgeSide: 1,
    calloutSide: -1,
    calloutTangentOffsetPt: Math.max(
      CALLOUT_TANGENT_OFFSET_PT,
      calloutTangentReach(inlet) + CALLOUT_SHAFT_GAP_PT,
    ),
  };
}

/** The four arrangements one arrow's labels can take, most normal first. */
function candidatesFor(inlet: PenetrationLabelInput): Candidate[] {
  const normal = defaultPenetrationLabelPlacement(inlet);
  // Beyond the badge, for when both labels share one side of the shaft.
  const farOffset =
    BADGE_TANGENT_OFFSET_PT +
    BADGE_RADIUS_PT +
    CALLOUT_BADGE_GAP_PT +
    calloutTangentReach(inlet);

  const build = (
    badgeSide: LabelSide,
    calloutSide: LabelSide,
    cost: number,
  ): Candidate => {
    const placement: PenetrationLabelPlacement = {
      badgeSide,
      calloutSide,
      calloutTangentOffsetPt:
        badgeSide === calloutSide ? farOffset : normal.calloutTangentOffsetPt,
    };
    return { placement, labels: labelsFor(inlet, placement), cost };
  };

  // Normal, then mirrored.
  const candidates = [build(1, -1, 0), build(-1, 1, 2)];
  if (inlet.calloutLineWidthsPt.length > 0) {
    // Badge stays put and the callout joins it, or both move to the far side.
    candidates.push(build(1, 1, 1), build(-1, -1, 3));
  }
  return candidates;
}

/** Shaft plus the X boot glyph of an arrow, as line segments. */
function arrowSegments(angleDeg: number): Segment[] {
  const outer = REFERENCE_RADIUS_PT;
  const glyphInner = outer - GLYPH_INNER_OFFSET_PT;
  const glyphOuter = outer - GLYPH_OUTER_OFFSET_PT;
  const at = (radial: number, tangent: number) =>
    polar(angleDeg, radial, tangent);
  return [
    {
      a: at(outer + ARROW_OVERSHOOT_PT, 0),
      b: at(outer - WALL_BAND_PT - ARROW_OVERSHOOT_PT, 0),
    },
    {
      a: at(glyphInner, -GLYPH_HALF_WIDTH_PT),
      b: at(glyphOuter, -GLYPH_HALF_WIDTH_PT),
    },
    {
      a: at(glyphInner, GLYPH_HALF_WIDTH_PT),
      b: at(glyphOuter, GLYPH_HALF_WIDTH_PT),
    },
    {
      a: at(glyphOuter, -GLYPH_HALF_WIDTH_PT),
      b: at(glyphOuter, GLYPH_HALF_WIDTH_PT),
    },
  ];
}

function distancePointToSegment(p: Point, s: Segment): number {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / lengthSq),
        );
  return Math.hypot(p.x - (s.a.x + dx * t), p.y - (s.a.y + dy * t));
}

function boxesOverlap(a: Box, b: Box, clearance: number): boolean {
  return (
    Math.abs(a.cx - b.cx) < a.halfWidth + b.halfWidth + clearance &&
    Math.abs(a.cy - b.cy) < a.halfHeight + b.halfHeight + clearance
  );
}

function circleOverlapsBox(c: Circle, b: Box, clearance: number): boolean {
  const dx = Math.max(Math.abs(c.cx - b.cx) - b.halfWidth, 0);
  const dy = Math.max(Math.abs(c.cy - b.cy) - b.halfHeight, 0);
  return Math.hypot(dx, dy) < c.radius + clearance;
}

function circlesOverlap(a: Circle, b: Circle, clearance: number): boolean {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.radius + b.radius + clearance;
}

function circleOverlapsSegment(
  c: Circle,
  s: Segment,
  clearance: number,
): boolean {
  return (
    distancePointToSegment({ x: c.cx, y: c.cy }, s) < c.radius + clearance
  );
}

/** Liang-Barsky clip of the segment against the box grown by `clearance`. */
function segmentOverlapsBox(s: Segment, b: Box, clearance: number): boolean {
  const minX = b.cx - b.halfWidth - clearance;
  const maxX = b.cx + b.halfWidth + clearance;
  const minY = b.cy - b.halfHeight - clearance;
  const maxY = b.cy + b.halfHeight + clearance;
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, s.a.x - minX],
    [dx, maxX - s.a.x],
    [-dy, s.a.y - minY],
    [dy, maxY - s.a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) {
        return false;
      }
      continue;
    }
    const t = q / p;
    if (p < 0) {
      t0 = Math.max(t0, t);
    } else {
      t1 = Math.min(t1, t);
    }
    if (t0 > t1) {
      return false;
    }
  }
  return true;
}

/**
 * Cost of two shapes' relationship: touching is an overlap, closer than the
 * clearance is merely tight, anything else is free.
 */
function graded(overlapsAt: (clearance: number) => boolean): number {
  if (overlapsAt(0)) {
    return OVERLAP_COST;
  }
  return overlapsAt(LABEL_CLEARANCE_PT) ? TIGHT_COST : 0;
}

/** Cost of two arrows' labels landing on or crowding each other. */
function labelConflictCost(a: Labels, b: Labels): number {
  let cost = graded((c) => circlesOverlap(a.badge, b.badge, c));
  const calloutA = a.callout;
  const calloutB = b.callout;
  if (calloutB) {
    cost += graded((c) => circleOverlapsBox(a.badge, calloutB, c));
  }
  if (calloutA) {
    cost += graded((c) => circleOverlapsBox(b.badge, calloutA, c));
  }
  if (calloutA && calloutB) {
    cost += graded((c) => boxesOverlap(calloutA, calloutB, c));
  }
  return cost;
}

/** Cost of one arrow's labels landing on or crowding fixed line work. */
function lineConflictCost(labels: Labels, segments: Segment[]): number {
  let cost = graded((c) =>
    segments.some((s) => circleOverlapsSegment(labels.badge, s, c)),
  );
  const callout = labels.callout;
  if (callout) {
    cost += graded((c) =>
      segments.some((s) => segmentOverlapsBox(s, callout, c)),
    );
  }
  return cost;
}

/** The static outlet arrow, its "A" badge and the callout above its tip. */
function outletObstacles(outlet: { calloutWidthPt: number | null }): {
  labels: Labels;
  segments: Segment[];
} {
  let callout: Box | null = null;
  if (outlet.calloutWidthPt != null) {
    const baselineY =
      REFERENCE_RADIUS_PT + ARROW_OVERSHOOT_PT + CALLOUT_ABOVE_TIP_GAP_PT;
    callout = {
      cx: 0,
      cy: baselineY + CALLOUT_FONT_SIZE_PT * 0.25,
      halfWidth: outlet.calloutWidthPt / 2 + CALLOUT_MASK_PADDING_PT,
      halfHeight: CALLOUT_FONT_SIZE_PT * 0.5 + CALLOUT_MASK_PADDING_PT,
    };
  }
  return {
    labels: { badge: badgeCircle(0, 1), callout },
    segments: arrowSegments(0),
  };
}

/**
 * Chooses a label arrangement for every inlet arrow on one circle. Returns
 * one placement per inlet, in input order. Arrows whose normal labels are
 * clear of everything keep the normal arrangement.
 */
export function layoutPenetrationLabels(
  input: PenetrationLabelLayoutInput,
): PenetrationLabelPlacement[] {
  const { inlets } = input;
  const candidates = inlets.map(candidatesFor);
  const segments = inlets.map((inlet) => arrowSegments(inlet.angleDegrees));
  const outlet = input.outlet ? outletObstacles(input.outlet) : null;

  // Cost of each candidate on its own: preference, its two labels against
  // each other, and against everything that cannot move.
  const ownCost = candidates.map((options, index) =>
    options.map((candidate) => {
      let cost = candidate.cost;
      const { badge, callout } = candidate.labels;
      if (callout && circleOverlapsBox(badge, callout, 0)) {
        cost += OVERLAP_COST;
      }
      segments.forEach((arrow, other) => {
        // Every arrangement clears the arrow it belongs to by construction.
        if (other !== index) {
          cost += lineConflictCost(candidate.labels, arrow);
        }
      });
      if (outlet) {
        cost += labelConflictCost(candidate.labels, outlet.labels);
        cost += lineConflictCost(candidate.labels, outlet.segments);
      }
      return cost;
    }),
  );

  const chosen = new Array<number>(inlets.length).fill(0);
  let best = chosen.slice();
  let bestCost = Number.POSITIVE_INFINITY;

  const search = (index: number, costSoFar: number) => {
    if (costSoFar >= bestCost) {
      return;
    }
    if (index === inlets.length) {
      bestCost = costSoFar;
      best = chosen.slice();
      return;
    }
    candidates[index]!.forEach((candidate, option) => {
      let cost = costSoFar + ownCost[index]![option]!;
      for (let earlier = 0; earlier < index; earlier += 1) {
        cost += labelConflictCost(
          candidate.labels,
          candidates[earlier]![chosen[earlier]!]!.labels,
        );
      }
      chosen[index] = option;
      search(index + 1, cost);
    });
  };
  search(0, 0);

  return best.map((option, index) => candidates[index]![option]!.placement);
}

/**
 * Counts real overlaps (a label on another label, on an arrow, or on the
 * outlet artwork) for a set of placements. Zero means every badge and
 * callout on the circle is readable.
 */
export function countPenetrationLabelOverlaps(
  input: PenetrationLabelLayoutInput,
  placements: PenetrationLabelPlacement[],
): number {
  const labels = input.inlets.map((inlet, index) =>
    labelsFor(inlet, placements[index]!),
  );
  const segments = input.inlets.map((inlet) =>
    arrowSegments(inlet.angleDegrees),
  );
  const outlet = input.outlet ? outletObstacles(input.outlet) : null;
  const hits = (cost: number) => Math.floor(cost / OVERLAP_COST);

  let count = 0;
  labels.forEach((own, index) => {
    if (own.callout && circleOverlapsBox(own.badge, own.callout, 0)) {
      count += 1;
    }
    segments.forEach((arrow, other) => {
      if (other !== index) {
        count += hits(lineConflictCost(own, arrow));
      }
    });
    if (outlet) {
      count += hits(labelConflictCost(own, outlet.labels));
      count += hits(lineConflictCost(own, outlet.segments));
    }
    for (let earlier = 0; earlier < index; earlier += 1) {
      count += hits(labelConflictCost(own, labels[earlier]!));
    }
  });
  return count;
}
