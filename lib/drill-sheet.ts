// Pure calculation helpers for circular manhole drill sheets.
//
// All elevations and heights are expressed in DECIMAL FEET unless a name ends in
// `Inches`. These functions are framework-agnostic (no Prisma / React imports) so
// they can run on the server (actions) and in the browser (live preview).

export type SectionRole = "BASE" | "RISER";

export type BootSize = {
  pipeDiameterInches: number;
  holeDiameterInches: number;
};

export type TemplateSectionOption = {
  role: SectionRole;
  heightFeet: number;
  label?: string | null;
};

export type DiameterConfig = {
  insideDiameterFeet: number;
  moldMaxHeightFeet: number;
  topSlabHeightWithKeyFeet: number | null;
  topSlabHeightNoKeyFeet: number | null;
  sections: TemplateSectionOption[];
};

export type TemplateConfig = {
  minimumBrickFeet: number;
  keyClearanceFeet: number;
  bootSizes: BootSize[];
};

export type DrillSheetOpeningInput = {
  label?: string | null;
  pipeType?: string | null;
  pipeDiameterInches: number | null;
  invertElevation: number | null;
  hasBoot: boolean;
  angleDegrees?: number | null;
};

export type DrillSheetInput = {
  rimElevation: number | null;
  castingHeightFeet: number | null;
  diameter: DiameterConfig;
  template: TemplateConfig;
  openings: DrillSheetOpeningInput[];
  /** Force key on/off instead of auto-determining from clearance. */
  hasKeyOverride?: boolean | null;
  /** Override the computed brick adjustment (decimal feet). */
  brickAdjustmentOverrideFeet?: number | null;
};

export type ComputedSection = {
  role: SectionRole;
  heightFeet: number;
  label?: string | null;
};

export type ComputedOpening = DrillSheetOpeningInput & {
  holeDiameterInches: number | null;
  isLowInvert: boolean;
};

export type DrillSheetResult = {
  rimElevation: number | null;
  lowInvertElevation: number | null;
  invertToTopFeet: number | null;
  castingHeightFeet: number;
  topSlabHeightFeet: number;
  sumpFeet: number;
  availableFeet: number | null;
  wallHeightFeet: number;
  brickAdjustmentFeet: number;
  hasKey: boolean;
  sections: ComputedSection[];
  openings: ComputedOpening[];
  warnings: string[];
};

const SCALE = 100; // hundredths of a foot for integer section math
const EPSILON = 1e-6;

function round4(value: number): number {
  return Math.round((value + EPSILON) * 10000) / 10000;
}

/** Looks up the boot hole diameter for a pipe size; returns null if not configured. */
export function lookupHoleDiameter(
  bootSizes: BootSize[],
  pipeDiameterInches: number | null,
): number | null {
  if (pipeDiameterInches == null) {
    return null;
  }
  const match = bootSizes.find(
    (boot) => Math.abs(boot.pipeDiameterInches - pipeDiameterInches) < EPSILON,
  );
  return match ? match.holeDiameterInches : null;
}

/** Sump (floor to low invert) in feet = (hole - pipe) / 2, in inches, converted. */
export function computeSumpFeet(
  holeDiameterInches: number | null,
  pipeDiameterInches: number | null,
): number {
  if (holeDiameterInches == null || pipeDiameterInches == null) {
    return 0;
  }
  const sumpInches = (holeDiameterInches - pipeDiameterInches) / 2;
  return round4(Math.max(sumpInches, 0) / 12);
}

export function computeInvertToTopFeet(
  rimElevation: number | null,
  lowInvertElevation: number | null,
): number | null {
  if (rimElevation == null || lowInvertElevation == null) {
    return null;
  }
  return round4(rimElevation - lowInvertElevation);
}

/**
 * Maximizes the total riser height that is <= target using the given riser sizes
 * with unlimited repeats. Returns the chosen riser heights (decimal feet).
 */
function maximizeRisers(riserSizesFeet: number[], targetFeet: number): number[] {
  const target = Math.floor(targetFeet * SCALE + EPSILON);
  const sizes = riserSizesFeet
    .map((feet) => Math.round(feet * SCALE))
    .filter((size) => size > 0);

  if (target <= 0 || sizes.length === 0) {
    return [];
  }

  const reachable = new Array<boolean>(target + 1).fill(false);
  const parentSize = new Array<number>(target + 1).fill(0);
  reachable[0] = true;

  for (let value = 1; value <= target; value += 1) {
    for (const size of sizes) {
      if (size <= value && reachable[value - size]) {
        reachable[value] = true;
        parentSize[value] = size;
        break;
      }
    }
  }

  let best = target;
  while (best > 0 && !reachable[best]) {
    best -= 1;
  }

  const chosen: number[] = [];
  let cursor = best;
  while (cursor > 0) {
    const size = parentSize[cursor];
    if (size <= 0) {
      break;
    }
    chosen.push(round4(size / SCALE));
    cursor -= size;
  }

  return chosen;
}

/**
 * Picks a base + riser combination whose total wall height is as close as
 * possible to (but not exceeding) `maxWallFeet`, preferring a single base.
 */
export function selectSections(
  diameter: DiameterConfig,
  maxWallFeet: number,
): { sections: ComputedSection[]; wallHeightFeet: number } {
  const moldMax = diameter.moldMaxHeightFeet;
  const fits = (height: number) =>
    moldMax > 0 ? height <= moldMax + EPSILON : true;

  const baseOptions = diameter.sections
    .filter((section) => section.role === "BASE" && fits(section.heightFeet))
    .sort((a, b) => b.heightFeet - a.heightFeet);
  const riserOptions = diameter.sections.filter(
    (section) => section.role === "RISER" && fits(section.heightFeet),
  );
  const riserSizes = riserOptions.map((section) => section.heightFeet);

  let best: { sections: ComputedSection[]; wallHeightFeet: number } | null =
    null;

  const considerBase = (base: ComputedSection | null) => {
    const baseHeight = base ? base.heightFeet : 0;
    if (baseHeight > maxWallFeet + EPSILON) {
      return;
    }
    const riserHeights = maximizeRisers(riserSizes, maxWallFeet - baseHeight);
    const total = round4(
      baseHeight + riserHeights.reduce((sum, value) => sum + value, 0),
    );
    if (!best || total > best.wallHeightFeet + EPSILON) {
      const sections: ComputedSection[] = [];
      if (base) {
        sections.push(base);
      }
      for (const height of riserHeights) {
        const option = riserOptions.find(
          (riser) => Math.abs(riser.heightFeet - height) < EPSILON,
        );
        sections.push({
          role: "RISER",
          heightFeet: height,
          label: option?.label ?? null,
        });
      }
      best = { sections, wallHeightFeet: total };
    }
  };

  if (baseOptions.length === 0) {
    considerBase(null);
  } else {
    for (const base of baseOptions) {
      considerBase({
        role: "BASE",
        heightFeet: base.heightFeet,
        label: base.label ?? null,
      });
    }
    // Fall back to the smallest base if none fit under the target.
    if (!best || best.wallHeightFeet <= EPSILON) {
      const smallestBase = baseOptions[baseOptions.length - 1];
      best = {
        sections: [
          {
            role: "BASE",
            heightFeet: smallestBase.heightFeet,
            label: smallestBase.label ?? null,
          },
        ],
        wallHeightFeet: round4(smallestBase.heightFeet),
      };
    }
  }

  return best ?? { sections: [], wallHeightFeet: 0 };
}

function getTopSlabHeight(diameter: DiameterConfig, hasKey: boolean): number {
  const withKey = diameter.topSlabHeightWithKeyFeet ?? 0;
  const noKey = diameter.topSlabHeightNoKeyFeet ?? withKey;
  return hasKey ? withKey : noKey;
}

/** Top elevation of the highest pipe boot hole, or null if undeterminable. */
function highestHoleTopElevation(openings: ComputedOpening[]): number | null {
  let highest: number | null = null;
  for (const opening of openings) {
    if (
      opening.invertElevation == null ||
      opening.pipeDiameterInches == null ||
      opening.holeDiameterInches == null
    ) {
      continue;
    }
    const holeTop =
      opening.invertElevation +
      opening.pipeDiameterInches / 2 / 12 +
      opening.holeDiameterInches / 2 / 12;
    if (highest == null || holeTop > highest) {
      highest = holeTop;
    }
  }
  return highest;
}

/** Resolves boot hole sizes and flags the lowest-invert opening. */
function resolveOpenings(
  openings: DrillSheetOpeningInput[],
  bootSizes: BootSize[],
): ComputedOpening[] {
  let lowInvert: number | null = null;
  for (const opening of openings) {
    if (
      opening.invertElevation != null &&
      (lowInvert == null || opening.invertElevation < lowInvert)
    ) {
      lowInvert = opening.invertElevation;
    }
  }

  return openings.map((opening) => ({
    ...opening,
    holeDiameterInches: opening.hasBoot
      ? lookupHoleDiameter(bootSizes, opening.pipeDiameterInches)
      : null,
    isLowInvert:
      opening.invertElevation != null &&
      lowInvert != null &&
      Math.abs(opening.invertElevation - lowInvert) < EPSILON,
  }));
}

/**
 * Computes a full circular manhole drill sheet from rim/invert inputs.
 *
 * Wall Height = (Rim - Low Invert) - Casting - Top Slab + Sump - Brick.
 * The base/riser combo is auto-picked to leave brick >= the template minimum,
 * and the key is determined from pipe clearance (both overridable).
 */
export function computeDrillSheet(input: DrillSheetInput): DrillSheetResult {
  const warnings: string[] = [];
  const openings = resolveOpenings(input.openings, input.template.bootSizes);

  const lowInvertOpening = openings.find((opening) => opening.isLowInvert);
  const lowInvertElevation = lowInvertOpening?.invertElevation ?? null;

  const sumpFeet = lowInvertOpening
    ? computeSumpFeet(
        lowInvertOpening.holeDiameterInches,
        lowInvertOpening.pipeDiameterInches,
      )
    : 0;

  if (lowInvertOpening && lowInvertOpening.hasBoot) {
    if (lowInvertOpening.pipeDiameterInches == null) {
      warnings.push("Low-invert opening is missing a pipe diameter.");
    } else if (lowInvertOpening.holeDiameterInches == null) {
      warnings.push(
        `No boot hole size configured for a ${lowInvertOpening.pipeDiameterInches}" pipe; sump is 0.`,
      );
    }
  }

  const invertToTopFeet = computeInvertToTopFeet(
    input.rimElevation,
    lowInvertElevation,
  );
  const castingHeightFeet = input.castingHeightFeet ?? 0;
  const minBrick = input.template.minimumBrickFeet ?? 0;

  const computeForKey = (hasKey: boolean) => {
    const topSlabHeightFeet = getTopSlabHeight(input.diameter, hasKey);
    if (invertToTopFeet == null) {
      return {
        hasKey,
        topSlabHeightFeet,
        availableFeet: null as number | null,
        sections: [] as ComputedSection[],
        wallHeightFeet: 0,
        brickAdjustmentFeet: 0,
      };
    }
    const availableFeet = round4(
      invertToTopFeet - castingHeightFeet - topSlabHeightFeet + sumpFeet,
    );
    const maxWall = Math.max(availableFeet - minBrick, 0);
    const { sections, wallHeightFeet } = selectSections(
      input.diameter,
      maxWall,
    );
    const brickAdjustmentFeet = round4(availableFeet - wallHeightFeet);
    return {
      hasKey,
      topSlabHeightFeet,
      availableFeet,
      sections,
      wallHeightFeet,
      brickAdjustmentFeet,
    };
  };

  let hasKey: boolean;
  if (input.hasKeyOverride != null) {
    hasKey = input.hasKeyOverride;
  } else {
    // Pass 1: assume a key, then check that the highest hole clears the keyway.
    const trial = computeForKey(true);
    hasKey = true;
    const highestHole = highestHoleTopElevation(openings);
    if (
      trial.availableFeet != null &&
      lowInvertElevation != null &&
      highestHole != null
    ) {
      const floorElevation = lowInvertElevation - sumpFeet;
      const wallTopElevation = floorElevation + trial.wallHeightFeet;
      if (wallTopElevation - highestHole < input.template.keyClearanceFeet) {
        hasKey = false;
      }
    }
  }

  const result = computeForKey(hasKey);

  let brickAdjustmentFeet = result.brickAdjustmentFeet;
  let wallHeightFeet = result.wallHeightFeet;
  let sections = result.sections;
  if (input.brickAdjustmentOverrideFeet != null && result.availableFeet != null) {
    brickAdjustmentFeet = round4(input.brickAdjustmentOverrideFeet);
    const maxWall = Math.max(result.availableFeet - brickAdjustmentFeet, 0);
    const reselected = selectSections(input.diameter, maxWall);
    sections = reselected.sections;
    wallHeightFeet = reselected.wallHeightFeet;
    brickAdjustmentFeet = round4(result.availableFeet - wallHeightFeet);
  }

  if (result.availableFeet != null && brickAdjustmentFeet < minBrick - EPSILON) {
    warnings.push(
      `Brick adjustment (${brickAdjustmentFeet.toFixed(2)}') is below the ${minBrick.toFixed(2)}' minimum.`,
    );
  }
  if (sections.length === 0 && invertToTopFeet != null) {
    warnings.push("No base/riser sections are configured for this diameter.");
  }

  return {
    rimElevation: input.rimElevation,
    lowInvertElevation,
    invertToTopFeet,
    castingHeightFeet: round4(castingHeightFeet),
    topSlabHeightFeet: round4(result.topSlabHeightFeet),
    sumpFeet,
    availableFeet: result.availableFeet,
    wallHeightFeet: round4(wallHeightFeet),
    brickAdjustmentFeet,
    hasKey,
    sections,
    openings,
    warnings,
  };
}

/** Formats decimal feet as a foot-inch string, e.g. 10.5 -> 10'-6". */
export function formatFeetInches(feet: number | null | undefined): string {
  if (feet == null || Number.isNaN(feet)) {
    return "—";
  }
  const sign = feet < 0 ? "-" : "";
  const absFeet = Math.abs(feet);
  let wholeFeet = Math.floor(absFeet + EPSILON);
  let inches = Math.round((absFeet - wholeFeet) * 12);
  if (inches === 12) {
    wholeFeet += 1;
    inches = 0;
  }
  return `${sign}${wholeFeet}'-${inches}"`;
}
