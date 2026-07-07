// Pure calculation helpers for rectangular structure sheets (catch basins,
// leaching basins, box structures).
//
// All elevations and heights are expressed in DECIMAL FEET unless a name ends
// in `Inches`. Framework-agnostic (no Prisma / React imports).
//
// Differences from the circular drill sheet (lib/drill-sheet.ts):
//   - Openings are rectangular block-outs (width x height) from their own
//     catalog; skewed pipes have no widening formula — the width is overridden
//     manually per opening (height stays the same).
//   - Top and base slabs are both optional. The top slab is omitted when the
//     casting sits directly on the walls; it is always a separate pick. The
//     base slab may be cast attached to the bottom wall section (in its pick
//     weight) or be a separate piece.
//   - Section splits are entered manually (driven by the contractor's max
//     pick weight), with a per-joint key toggle and no joint clearance rules.
//   - Pricing is per vertical foot of wall from the template, with a minimum
//     billed height.

import { computeWallHeightFeet, type SumpMode } from "@/lib/drill-sheet";

export type RectWall = "UP" | "DOWN" | "LEFT" | "RIGHT";

export type RectOpeningPlacement =
  | "CENTERED"
  | "FROM_LEFT"
  | "FROM_RIGHT"
  | "TOUCH_LEFT"
  | "TOUCH_RIGHT";

export const RECT_WALLS: RectWall[] = ["UP", "DOWN", "LEFT", "RIGHT"];

/** Display labels for wall directions. */
export const RECT_WALL_LABELS: Record<RectWall, string> = {
  UP: "Up",
  DOWN: "Down",
  LEFT: "Left",
  RIGHT: "Right",
};

/** Concrete unit weight used for pick weights. */
export const CONCRETE_PCF = 150;

export type RectOpeningSizeEntry = {
  pipeMaterial: string;
  pipeSizeInches: number;
  openingWidthInches: number;
  openingHeightInches: number;
  pricePerOpening: number | null;
};

export type RectTemplateConfig = {
  wallThicknessInches: number;
  baseSlabThicknessInches: number;
  topSlabThicknessInches: number;
  minimumBrickInches: number;
  sumpMode: SumpMode;
  sumpFixedInches: number | null;
  /** Wall price per vertical foot of wall height. */
  wallPricePerFoot: number;
  /** Minimum billed wall height in feet (0 = no minimum). */
  minPricingHeightFeet: number;
  /** Top slab price; charged only when the sheet has a top slab. */
  topSlabPrice: number;
  /** Base slab price; charged only when the sheet has a base slab. */
  baseSlabPrice: number;
};

export type RectOpeningInput = {
  label?: string | null;
  wall: RectWall | null;
  pipeMaterial?: string | null;
  pipeSizeInches: number | null;
  invertElevation: number | null;
  /** Skew angle note (degrees off perpendicular); informational only. */
  angleDegrees?: number | null;
  placement: RectOpeningPlacement;
  /** Centerline offset from the referenced inside face, inches (FROM_LEFT / FROM_RIGHT). */
  offsetInches: number | null;
  /** Manual width override for skewed pipes, inches (height stays catalog). */
  widthOverrideInches: number | null;
};

export type RectTopSlabOpening = {
  lengthInches: number | null;
  widthInches: number | null;
  /** Wall whose inside edge the opening touches. */
  side: RectWall | null;
};

export type RectSectionInput = {
  heightFeet: number;
  /** Keyed joint at the TOP of this section (mating faces must match). */
  hasTopKey: boolean;
  label?: string | null;
};

export type RectStructureInput = {
  rimElevation: number | null;
  castingHeightFeet: number | null;
  insideLengthFeet: number | null;
  insideWidthFeet: number | null;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  /** Base slab cast monolithically with the bottom wall section. */
  baseAttached: boolean;
  template: RectTemplateConfig;
  openingSizes: RectOpeningSizeEntry[];
  openings: RectOpeningInput[];
  /** Manual section heights, bottom-to-top. Empty = single pour. */
  sectionHeightsFeet: number[];
  /** Key toggle for the joint above section i (length = sections - 1). */
  jointKeys: boolean[];
  topSlabOpening: RectTopSlabOpening | null;
};

export type ComputedRectOpening = RectOpeningInput & {
  openingWidthInches: number | null;
  openingHeightInches: number | null;
  /** Catalog width before any manual skew override. */
  catalogWidthInches: number | null;
  pricePerOpening: number | null;
  isLowInvert: boolean;
  bottomOfOpeningFeet: number | null;
  topOfOpeningFeet: number | null;
  /** Opening bottom above the structure floor, whole inches. */
  floorToOpeningBottomInches: number | null;
  /** Index of the wall section this opening penetrates (bottom = 0). */
  sectionIndex: number | null;
  /** Opening bottom above its section's bottom, whole inches. */
  sectionBottomToOpeningBottomInches: number | null;
  /** Horizontal extent along the wall, inches from the LEFT inside face. */
  leftEdgeInches: number | null;
  rightEdgeInches: number | null;
};

export type ComputedRectSection = {
  index: number;
  heightFeet: number;
  label: string | null;
  hasBottomKey: boolean;
  hasTopKey: boolean;
  /** Pick weight in pounds (includes attached base slab on the bottom section). */
  pickWeightLbs: number;
  includesBaseSlab: boolean;
};

export type RectPickWeights = {
  sections: number[];
  /** Separate base piece (null when no base or base attached). */
  baseSlabLbs: number | null;
  /** Top slab piece (always separate; null when no top slab). */
  topSlabLbs: number | null;
  heaviestLbs: number | null;
};

export type RectStructureResult = {
  rimElevation: number | null;
  lowInvertElevation: number | null;
  invertToTopFeet: number | null;
  castingHeightFeet: number;
  insideLengthFeet: number | null;
  insideWidthFeet: number | null;
  outsideLengthFeet: number | null;
  outsideWidthFeet: number | null;
  wallThicknessFeet: number;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  baseAttached: boolean;
  topSlabThicknessFeet: number;
  baseSlabThicknessFeet: number;
  sumpFeet: number;
  rawAvailableFeet: number | null;
  wallHeightFeet: number;
  brickFeet: number;
  /** Floor elevation: top of base slab, or bottom of walls when no base. */
  floorElevation: number | null;
  totalHeightFeet: number | null;
  sections: ComputedRectSection[];
  openings: ComputedRectOpening[];
  topSlabOpening: RectTopSlabOpening | null;
  weights: RectPickWeights;
  wallPrice: number;
  /** Top slab component price (0 when the sheet has no top slab). */
  topSlabPrice: number;
  /** Base slab component price (0 when the sheet has no base slab). */
  baseSlabPrice: number;
  openingsPrice: number;
  totalPrice: number;
  /** True when the minimum billed height kicked in. */
  minPricingApplied: boolean;
  errorMessage: string | null;
  warnings: string[];
};

const EPSILON = 1e-6;

function round4(value: number): number {
  return Math.round((value + EPSILON) * 10000) / 10000;
}

function round2(value: number): number {
  return Math.round((value + EPSILON) * 100) / 100;
}

function inchesToFeet(inches: number): number {
  return inches / 12;
}

/**
 * Looks up a rectangular opening size by combined material string and pipe
 * size. Matching mirrors lookupPipeOpeningSize (case/whitespace-insensitive).
 */
export function lookupRectOpeningSize(
  catalog: RectOpeningSizeEntry[],
  material: string | null | undefined,
  sizeInches: number | null,
): RectOpeningSizeEntry | null {
  if (!material || sizeInches == null || !Number.isFinite(sizeInches)) {
    return null;
  }
  const wanted = material.trim().toLowerCase().replace(/\s+/g, " ");
  return (
    catalog.find(
      (entry) =>
        Math.abs(entry.pipeSizeInches - sizeInches) < EPSILON &&
        entry.pipeMaterial.trim().toLowerCase().replace(/\s+/g, " ") === wanted,
    ) ?? null
  );
}

/**
 * Default sump (feet): pipe centered vertically in the block-out, so the
 * drop below the invert is half the opening-height/pipe-size difference —
 * same rule as the circular sheet's hole/pipe pair.
 */
export function computeRectDefaultSumpFeet(
  openingHeightInches: number | null,
  pipeSizeInches: number | null,
): number {
  if (openingHeightInches == null || pipeSizeInches == null) {
    return 0;
  }
  const sumpInches = (openingHeightInches - pipeSizeInches) / 2;
  return round4(Math.max(sumpInches, 0) / 12);
}

/** Inside dimension (feet) of the wall an opening sits in (Up/Down run the length; Left/Right the width). */
export function wallInsideRunFeet(
  wall: RectWall,
  insideLengthFeet: number,
  insideWidthFeet: number,
): number {
  return wall === "UP" || wall === "DOWN" ? insideLengthFeet : insideWidthFeet;
}

/**
 * Wall height rounded DOWN to 6" increments (rect walls pour in 6" steps,
 * same as circular), remainder becomes brick; a configured minimum brick
 * forces at least that much grade adjustment.
 */
export function computeRectWallHeightFeet(
  rawAvailableFeet: number,
  minimumBrickInches: number,
): { wallHeightFeet: number; brickFeet: number } {
  return computeWallHeightFeet(rawAvailableFeet, minimumBrickInches);
}

function resolveOpenings(
  openings: RectOpeningInput[],
  catalog: RectOpeningSizeEntry[],
): ComputedRectOpening[] {
  let lowInvert: number | null = null;
  for (const opening of openings) {
    if (
      opening.invertElevation != null &&
      (lowInvert == null || opening.invertElevation < lowInvert)
    ) {
      lowInvert = opening.invertElevation;
    }
  }

  return openings.map((opening) => {
    const match = lookupRectOpeningSize(
      catalog,
      opening.pipeMaterial,
      opening.pipeSizeInches,
    );
    const catalogWidth = match?.openingWidthInches ?? null;
    return {
      ...opening,
      catalogWidthInches: catalogWidth,
      openingWidthInches: opening.widthOverrideInches ?? catalogWidth,
      openingHeightInches: match?.openingHeightInches ?? null,
      pricePerOpening: match?.pricePerOpening ?? null,
      isLowInvert:
        opening.invertElevation != null &&
        lowInvert != null &&
        Math.abs(opening.invertElevation - lowInvert) < EPSILON,
      bottomOfOpeningFeet: null,
      topOfOpeningFeet: null,
      floorToOpeningBottomInches: null,
      sectionIndex: null,
      sectionBottomToOpeningBottomInches: null,
      leftEdgeInches: null,
      rightEdgeInches: null,
    };
  });
}

/** Pipe centered vertically in the block-out: opening center = invert + pipe/2. */
function computeVerticalGeometry(
  opening: ComputedRectOpening,
  floorElevation: number | null,
): ComputedRectOpening {
  if (opening.invertElevation == null || opening.openingHeightInches == null) {
    return opening;
  }
  const pipeSize = opening.pipeSizeInches ?? 0;
  const center = opening.invertElevation + inchesToFeet(pipeSize / 2);
  const half = inchesToFeet(opening.openingHeightInches / 2);
  const bottomOfOpeningFeet = round4(center - half);
  const topOfOpeningFeet = round4(center + half);
  return {
    ...opening,
    bottomOfOpeningFeet,
    topOfOpeningFeet,
    floorToOpeningBottomInches:
      floorElevation != null
        ? Math.round((bottomOfOpeningFeet - floorElevation) * 12)
        : null,
  };
}

/**
 * Horizontal extent along the wall, inches from the LEFT inside face (looking
 * at the wall from inside the structure). CENTERED needs no dimension on the
 * sheet; TOUCH_LEFT / TOUCH_RIGHT pin the opening against that wall end.
 */
function computeHorizontalGeometry(
  opening: ComputedRectOpening,
  insideLengthFeet: number | null,
  insideWidthFeet: number | null,
  warnings: string[],
): ComputedRectOpening {
  if (
    opening.wall == null ||
    opening.openingWidthInches == null ||
    insideLengthFeet == null ||
    insideWidthFeet == null
  ) {
    return opening;
  }
  const runInches =
    wallInsideRunFeet(opening.wall, insideLengthFeet, insideWidthFeet) * 12;
  const width = opening.openingWidthInches;
  const label = opening.label?.trim() || "?";

  let left: number;
  switch (opening.placement) {
    case "TOUCH_LEFT":
      left = 0;
      break;
    case "TOUCH_RIGHT":
      left = runInches - width;
      break;
    case "FROM_LEFT":
      left = (opening.offsetInches ?? runInches / 2) - width / 2;
      break;
    case "FROM_RIGHT":
      left = runInches - (opening.offsetInches ?? runInches / 2) - width / 2;
      break;
    case "CENTERED":
    default:
      left = (runInches - width) / 2;
      break;
  }
  const right = left + width;

  if (width > runInches + EPSILON) {
    warnings.push(
      `Opening ${label} (${width}" wide) is wider than the ${RECT_WALL_LABELS[opening.wall]} wall (${Math.round(runInches)}" inside).`,
    );
  } else if (left < -EPSILON || right > runInches + EPSILON) {
    warnings.push(
      `Opening ${label} extends past the end of the ${RECT_WALL_LABELS[opening.wall]} wall.`,
    );
  }

  return {
    ...opening,
    leftEdgeInches: round2(left),
    rightEdgeInches: round2(right),
  };
}

/** Marks each opening with the manual section it penetrates (bottom = 0). */
export function annotateRectOpeningSections(
  openings: ComputedRectOpening[],
  sections: ComputedRectSection[],
  floorElevation: number | null,
  warnings: string[],
): ComputedRectOpening[] {
  if (floorElevation == null || sections.length === 0) {
    return openings;
  }

  const bounds: { index: number; lo: number; hi: number }[] = [];
  let cursor = floorElevation;
  for (const section of sections) {
    bounds.push({
      index: section.index,
      lo: cursor,
      hi: round4(cursor + section.heightFeet),
    });
    cursor = round4(cursor + section.heightFeet);
  }

  return openings.map((opening) => {
    if (opening.bottomOfOpeningFeet == null) {
      return opening;
    }
    const bottom = opening.bottomOfOpeningFeet;
    const top = opening.topOfOpeningFeet ?? bottom;
    const label = opening.label?.trim() || "?";

    const holder =
      bounds.find((b) => bottom >= b.lo - EPSILON && top <= b.hi + EPSILON) ??
      null;
    if (!holder) {
      const overlapping = bounds.find(
        (b) => bottom < b.hi - EPSILON && top > b.lo + EPSILON,
      );
      if (overlapping && bounds.length > 1) {
        warnings.push(
          `Opening ${label} crosses a section joint — adjust the split heights.`,
        );
      } else if (bottom < bounds[0].lo - EPSILON) {
        warnings.push(`Opening ${label} extends below the floor.`);
      } else if (top > bounds[bounds.length - 1].hi + EPSILON) {
        warnings.push(`Opening ${label} extends above the top of the walls.`);
      }
      return opening;
    }
    return {
      ...opening,
      sectionIndex: holder.index,
      sectionBottomToOpeningBottomInches: Math.round((bottom - holder.lo) * 12),
    };
  });
}

/** Shell (perimeter wall) plan area in square feet. */
function shellPlanAreaSqFt(
  insideLengthFeet: number,
  insideWidthFeet: number,
  wallThicknessFeet: number,
): number {
  const outsideLength = insideLengthFeet + 2 * wallThicknessFeet;
  const outsideWidth = insideWidthFeet + 2 * wallThicknessFeet;
  return outsideLength * outsideWidth - insideLengthFeet * insideWidthFeet;
}

/** Full outside plan area in square feet (slabs are flush with the walls). */
function slabPlanAreaSqFt(
  insideLengthFeet: number,
  insideWidthFeet: number,
  wallThicknessFeet: number,
): number {
  return (
    (insideLengthFeet + 2 * wallThicknessFeet) *
    (insideWidthFeet + 2 * wallThicknessFeet)
  );
}

/** Pick weight (lbs) of a wall section, minus its opening block-outs. */
export function sectionWeightLbs(
  heightFeet: number,
  insideLengthFeet: number,
  insideWidthFeet: number,
  wallThicknessFeet: number,
  openingDeductionsCuFt: number,
): number {
  const volume =
    shellPlanAreaSqFt(insideLengthFeet, insideWidthFeet, wallThicknessFeet) *
      heightFeet -
    openingDeductionsCuFt;
  return round2(Math.max(volume, 0) * CONCRETE_PCF);
}

/** Slab weight (lbs), less an optional rectangular opening. */
export function slabWeightLbs(
  insideLengthFeet: number,
  insideWidthFeet: number,
  wallThicknessFeet: number,
  thicknessFeet: number,
  openingLengthFeet = 0,
  openingWidthFeet = 0,
): number {
  const area =
    slabPlanAreaSqFt(insideLengthFeet, insideWidthFeet, wallThicknessFeet) -
    openingLengthFeet * openingWidthFeet;
  return round2(Math.max(area, 0) * thicknessFeet * CONCRETE_PCF);
}

/** Block-out volume (cu ft) an opening removes from a section's wall. */
function openingDeductionCuFt(
  opening: ComputedRectOpening,
  wallThicknessFeet: number,
): number {
  if (opening.openingWidthInches == null || opening.openingHeightInches == null) {
    return 0;
  }
  return (
    inchesToFeet(opening.openingWidthInches) *
    inchesToFeet(opening.openingHeightInches) *
    wallThicknessFeet
  );
}

function computeRectPricing(
  wallHeightFeet: number,
  hasTopSlab: boolean,
  hasBaseSlab: boolean,
  template: RectTemplateConfig,
  openings: ComputedRectOpening[],
): {
  wallPrice: number;
  topSlabPrice: number;
  baseSlabPrice: number;
  openingsPrice: number;
  totalPrice: number;
  minPricingApplied: boolean;
} {
  const billedHeight = Math.max(
    wallHeightFeet,
    template.minPricingHeightFeet ?? 0,
  );
  const wallPrice = round2(billedHeight * template.wallPricePerFoot);
  const topSlabPrice = hasTopSlab ? round2(template.topSlabPrice ?? 0) : 0;
  const baseSlabPrice = hasBaseSlab ? round2(template.baseSlabPrice ?? 0) : 0;
  let openingsPrice = 0;
  for (const opening of openings) {
    if (opening.pricePerOpening != null) {
      openingsPrice += opening.pricePerOpening;
    }
  }
  openingsPrice = round2(openingsPrice);
  return {
    wallPrice,
    topSlabPrice,
    baseSlabPrice,
    openingsPrice,
    totalPrice: round2(
      wallPrice + topSlabPrice + baseSlabPrice + openingsPrice,
    ),
    minPricingApplied:
      wallHeightFeet > EPSILON &&
      billedHeight > wallHeightFeet + EPSILON,
  };
}

/**
 * Computes a full rectangular structure sheet from rim/invert inputs and
 * manual section splits.
 */
export function computeRectStructure(
  input: RectStructureInput,
): RectStructureResult {
  const warnings: string[] = [];
  const template = input.template;
  const castingHeightFeet = input.castingHeightFeet ?? 0;
  const wallThicknessFeet = round4(inchesToFeet(template.wallThicknessInches));
  const hasTopSlab = input.hasTopSlab;
  const hasBaseSlab = input.hasBaseSlab;
  const baseAttached = hasBaseSlab && input.baseAttached;

  let openings = resolveOpenings(input.openings, input.openingSizes);

  for (const opening of openings) {
    if (
      opening.pipeSizeInches != null &&
      opening.pipeMaterial &&
      opening.openingHeightInches == null
    ) {
      warnings.push(
        `No rectangular opening size configured for ${opening.pipeSizeInches}" ${opening.pipeMaterial}.`,
      );
    }
  }

  const lowInvertOpening = openings.find((o) => o.isLowInvert) ?? null;
  const lowInvertElevation = lowInvertOpening?.invertElevation ?? null;

  // Sump: lowest invert down to the floor (inside of the base slab, or the
  // bottom of the walls when there is no base slab) — same rules as circular.
  let sumpFeet = 0;
  if (template.sumpMode === "FIXED" && template.sumpFixedInches != null) {
    sumpFeet = round4(inchesToFeet(template.sumpFixedInches));
  } else if (lowInvertOpening) {
    sumpFeet = computeRectDefaultSumpFeet(
      lowInvertOpening.openingHeightInches,
      lowInvertOpening.pipeSizeInches,
    );
  }

  const invertToTopFeet =
    input.rimElevation != null && lowInvertElevation != null
      ? round4(input.rimElevation - lowInvertElevation)
      : null;

  const topSlabThicknessFeet = hasTopSlab
    ? round4(inchesToFeet(template.topSlabThicknessInches))
    : 0;
  const baseSlabThicknessFeet = hasBaseSlab
    ? round4(inchesToFeet(template.baseSlabThicknessInches))
    : 0;

  let rawAvailableFeet: number | null = null;
  let wallHeightFeet = 0;
  let brickFeet = 0;
  if (invertToTopFeet != null) {
    rawAvailableFeet = round4(
      invertToTopFeet - castingHeightFeet - topSlabThicknessFeet + sumpFeet,
    );
    const rounded = computeRectWallHeightFeet(
      rawAvailableFeet,
      template.minimumBrickInches,
    );
    wallHeightFeet = rounded.wallHeightFeet;
    brickFeet = rounded.brickFeet;
  }

  const floorElevation =
    lowInvertElevation != null ? round4(lowInvertElevation - sumpFeet) : null;

  openings = openings.map((opening) =>
    computeVerticalGeometry(opening, floorElevation),
  );
  openings = openings.map((opening) =>
    computeHorizontalGeometry(
      opening,
      input.insideLengthFeet,
      input.insideWidthFeet,
      warnings,
    ),
  );

  // Manual sections: default to a single pour of the full wall height.
  const rawHeights =
    input.sectionHeightsFeet.length > 0
      ? input.sectionHeightsFeet
      : wallHeightFeet > EPSILON
        ? [wallHeightFeet]
        : [];
  const sectionsSum = round4(
    rawHeights.reduce((sum, height) => sum + height, 0),
  );
  let errorMessage: string | null = null;
  if (
    rawHeights.length > 0 &&
    wallHeightFeet > EPSILON &&
    Math.abs(sectionsSum - wallHeightFeet) > 0.01
  ) {
    warnings.push(
      `Section heights total ${sectionsSum.toFixed(2)}' but the wall height is ${wallHeightFeet.toFixed(2)}'.`,
    );
  }

  const insideLength = input.insideLengthFeet;
  const insideWidth = input.insideWidthFeet;
  const canWeigh =
    insideLength != null &&
    insideLength > EPSILON &&
    insideWidth != null &&
    insideWidth > EPSILON;

  // Assign opening deductions per section for pick weights.
  const preliminaryBounds: { lo: number; hi: number }[] = [];
  {
    let cursor = floorElevation ?? 0;
    for (const height of rawHeights) {
      preliminaryBounds.push({ lo: cursor, hi: round4(cursor + height) });
      cursor = round4(cursor + height);
    }
  }
  const deductions = rawHeights.map((_, index) => {
    if (floorElevation == null) {
      return 0;
    }
    let total = 0;
    for (const opening of openings) {
      if (
        opening.bottomOfOpeningFeet != null &&
        opening.topOfOpeningFeet != null &&
        opening.bottomOfOpeningFeet >= preliminaryBounds[index].lo - EPSILON &&
        opening.topOfOpeningFeet <= preliminaryBounds[index].hi + EPSILON
      ) {
        total += openingDeductionCuFt(opening, wallThicknessFeet);
      }
    }
    return total;
  });

  const topSlabOpening = hasTopSlab ? input.topSlabOpening : null;

  const sections: ComputedRectSection[] = rawHeights.map((height, index) => {
    const includesBaseSlab = index === 0 && baseAttached;
    let weight = 0;
    if (canWeigh) {
      weight = sectionWeightLbs(
        height,
        insideLength,
        insideWidth,
        wallThicknessFeet,
        deductions[index],
      );
      if (includesBaseSlab) {
        weight = round2(
          weight +
            slabWeightLbs(
              insideLength,
              insideWidth,
              wallThicknessFeet,
              baseSlabThicknessFeet,
            ),
        );
      }
    }
    return {
      index,
      heightFeet: round4(height),
      label: null,
      // The bottom section sits on the base slab (or grade): no bottom key.
      hasBottomKey: index === 0 ? false : (input.jointKeys[index - 1] ?? false),
      hasTopKey:
        index === rawHeights.length - 1
          ? false
          : (input.jointKeys[index] ?? false),
      pickWeightLbs: weight,
      includesBaseSlab,
    };
  });

  const baseSlabLbs =
    canWeigh && hasBaseSlab && !baseAttached
      ? slabWeightLbs(
          insideLength,
          insideWidth,
          wallThicknessFeet,
          baseSlabThicknessFeet,
        )
      : null;
  const topSlabLbs =
    canWeigh && hasTopSlab
      ? slabWeightLbs(
          insideLength,
          insideWidth,
          wallThicknessFeet,
          topSlabThicknessFeet,
          inchesToFeet(topSlabOpening?.lengthInches ?? 0),
          inchesToFeet(topSlabOpening?.widthInches ?? 0),
        )
      : null;

  const pickCandidates = [
    ...sections.map((section) => section.pickWeightLbs),
    ...(baseSlabLbs != null ? [baseSlabLbs] : []),
    ...(topSlabLbs != null ? [topSlabLbs] : []),
  ].filter((weight) => weight > EPSILON);

  openings = annotateRectOpeningSections(
    openings,
    sections,
    floorElevation,
    warnings,
  );

  if (invertToTopFeet != null && invertToTopFeet <= 0) {
    errorMessage =
      "The lowest invert is at or above the rim elevation. Check the elevations.";
  }

  const pricing = computeRectPricing(
    wallHeightFeet,
    hasTopSlab,
    hasBaseSlab,
    template,
    openings,
  );

  const totalHeightFeet =
    invertToTopFeet != null
      ? round4(
          wallHeightFeet +
            topSlabThicknessFeet +
            castingHeightFeet +
            baseSlabThicknessFeet,
        )
      : null;

  return {
    rimElevation: input.rimElevation,
    lowInvertElevation,
    invertToTopFeet,
    castingHeightFeet: round4(castingHeightFeet),
    insideLengthFeet: insideLength,
    insideWidthFeet: insideWidth,
    outsideLengthFeet:
      insideLength != null
        ? round4(insideLength + 2 * wallThicknessFeet)
        : null,
    outsideWidthFeet:
      insideWidth != null ? round4(insideWidth + 2 * wallThicknessFeet) : null,
    wallThicknessFeet,
    hasTopSlab,
    hasBaseSlab,
    baseAttached,
    topSlabThicknessFeet,
    baseSlabThicknessFeet,
    sumpFeet,
    rawAvailableFeet,
    wallHeightFeet: round4(wallHeightFeet),
    brickFeet: round4(brickFeet),
    floorElevation,
    totalHeightFeet,
    sections,
    openings,
    topSlabOpening,
    weights: {
      sections: sections.map((section) => section.pickWeightLbs),
      baseSlabLbs,
      topSlabLbs,
      heaviestLbs:
        pickCandidates.length > 0 ? Math.max(...pickCandidates) : null,
    },
    wallPrice: pricing.wallPrice,
    topSlabPrice: pricing.topSlabPrice,
    baseSlabPrice: pricing.baseSlabPrice,
    openingsPrice: pricing.openingsPrice,
    totalPrice: pricing.totalPrice,
    minPricingApplied: pricing.minPricingApplied,
    errorMessage,
    warnings,
  };
}

/**
 * Ordered elevation ladder from rim down to the bottom of the structure,
 * including each manual section joint. Mirrors getStructureElevations for
 * the circular sheet but handles missing slabs.
 */
export function getRectStructureElevations(
  result: RectStructureResult,
): { key: string; label: string; elevation: number }[] {
  if (result.rimElevation == null) {
    return [];
  }
  const entries: { key: string; label: string; elevation: number }[] = [];
  let current = round4(result.rimElevation);

  entries.push({ key: "rim", label: "Rim Elevation", elevation: current });

  current = round4(current - result.castingHeightFeet);
  entries.push({
    key: "casting",
    label: "Bottom of Casting / Top of Brick",
    elevation: current,
  });

  current = round4(current - result.brickFeet);
  if (result.hasTopSlab) {
    entries.push({
      key: "top-slab-top",
      label: "Top of Top Slab",
      elevation: current,
    });
    current = round4(current - result.topSlabThicknessFeet);
    entries.push({
      key: "top-slab-bottom",
      label: "Bottom of Top Slab (Top of Wall)",
      elevation: current,
    });
  } else {
    entries.push({
      key: "wall-top",
      label: "Top of Wall",
      elevation: current,
    });
  }

  const reversed = [...result.sections].reverse();
  for (let i = 0; i < reversed.length - 1; i += 1) {
    current = round4(current - reversed[i].heightFeet);
    entries.push({
      key: `joint-${i}`,
      label: `Joint ${i + 1}${reversed[i].hasBottomKey ? " (keyed)" : ""}`,
      elevation: current,
    });
  }

  if (result.floorElevation != null) {
    entries.push({
      key: "floor",
      label: result.hasBaseSlab
        ? "Top of Bottom Slab (Floor)"
        : "Bottom of Walls",
      elevation: result.floorElevation,
    });
    if (result.hasBaseSlab && result.baseSlabThicknessFeet > EPSILON) {
      entries.push({
        key: "bottom-slab",
        label: "Bottom of Bottom Slab",
        elevation: round4(result.floorElevation - result.baseSlabThicknessFeet),
      });
    }
  }

  return entries;
}

/** Formats pounds with thousands separators, e.g. 12,340 lbs. */
export function formatPounds(lbs: number | null | undefined): string {
  if (lbs == null || Number.isNaN(lbs)) {
    return "—";
  }
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(lbs)} lbs`;
}
