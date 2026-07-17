// Pure calculation helpers for drill sheets.
//
// All elevations and heights are expressed in DECIMAL FEET unless a name ends in
// `Inches`. Framework-agnostic (no Prisma / React imports).

export type SectionRole = "BASE" | "RISER";

export type PipeConnectionType =
  | "KOR_N_SEAL"
  | "CAST_IN"
  | "GROUTED"
  | "OTHER";

export type SumpMode = "DEFAULT" | "FIXED";

export type PipeOpeningSizeEntry = {
  pipeMaterial: string;
  pipeSizeInches: number;
  pipeType: string;
  /** Boot connection (Kor-N-Seal) vs. grouted/no-boot opening. */
  hasBoot: boolean;
  holeDiameterInches: number;
  /** Pipe wall thickness in inches; pipe OD = size + 2 × wall. */
  pipeWallThicknessInches: number;
  bootModel?: string | null;
  pricePerBoot?: number | null;
};

export type DiameterConfig = {
  insideDiameterFeet: number;
  maxBaseHeightFeet: number;
  maxRiserHeightFeet: number;
  keyHeightFeet: number;
  wallPricePerFoot: number;
  basePrice: number;
  /** Mold registry extras (display/enforcement; the calc doesn't use them). */
  label?: string | null;
  wallThicknessInches?: number | null;
};

export type TemplateConfig = {
  wallThicknessInches: number;
  baseSlabThicknessInches: number;
  topSlabThicknessInches: number;
  minimumBrickInches: number;
  connectionType: PipeConnectionType;
  sumpMode: SumpMode;
  sumpFixedInches: number | null;
  openingToJointMinTopInches: number;
  openingToJointMinBottomInches: number;
};

export type DrillSheetOpeningInput = {
  label?: string | null;
  pipeMaterial?: string | null;
  pipeSizeInches: number | null;
  pipeType?: string | null;
  invertElevation: number | null;
  angleDegrees?: number | null;
  connectionType?: PipeConnectionType | null;
};

export type DrillSheetInput = {
  rimElevation: number | null;
  castingHeightFeet: number | null;
  diameter: DiameterConfig;
  template: TemplateConfig;
  pipeOpeningSizes: PipeOpeningSizeEntry[];
  openings: DrillSheetOpeningInput[];
};

export type ComputedSection = {
  role: SectionRole;
  heightFeet: number;
  label?: string | null;
  /** Keyed joint at the bottom of this section (always false for the base, which sits on the slab). */
  hasBottomKey: boolean;
  /** Keyed joint at the top of this section (topmost section mirrors the top-slab key). */
  hasTopKey: boolean;
};

export type ComputedOpening = DrillSheetOpeningInput & {
  holeDiameterInches: number | null;
  bootModel: string | null;
  pricePerBoot: number | null;
  /** Boot connection: hole position is fixed (pipe centered) and needs joint clearance. */
  hasBoot: boolean;
  pipeWallThicknessInches: number | null;
  isLowInvert: boolean;
  topOfPipeFeet: number | null;
  bottomOfOpeningFeet: number | null;
  topOfOpeningFeet: number | null;
  baseTopToOpeningBottomInches: number | null;
  /** Role of the section whose wall this hole penetrates (BASE or RISER). */
  containingSectionRole: SectionRole | null;
  /** Bottom of opening above the containing section's bottom, whole inches. */
  sectionBottomToOpeningBottomInches: number | null;
};

export type DrillSheetResult = {
  rimElevation: number | null;
  lowInvertElevation: number | null;
  invertToTopFeet: number | null;
  castingHeightFeet: number;
  topSlabThicknessFeet: number;
  sumpFeet: number;
  rawAvailableFeet: number | null;
  wallHeightFeet: number;
  brickFeet: number;
  hasKey: boolean;
  /** Key height for this diameter (drawing detail; 4" when unknown). */
  keyHeightFeet: number;
  totalHeightFeet: number | null;
  baseSlabThicknessFeet: number | null;
  sections: ComputedSection[];
  openings: ComputedOpening[];
  /**
   * Piece weights in lb, parallel to `sections` (the base piece includes the
   * monolithic floor slab). Null when the mold has no wall thickness.
   */
  sectionWeightsLb: number[] | null;
  topSlabWeightLb: number | null;
  totalWeightLb: number | null;
  wallPrice: number;
  bootsPrice: number;
  totalPrice: number;
  errorMessage: string | null;
  warnings: string[];
};

const EPSILON = 1e-6;
const SIX_INCHES_FEET = 0.5;

/**
 * Combined pipe description for display, e.g. "PVC SDR35". New records keep
 * the whole string in `pipeMaterial`; legacy records split it across
 * material and type.
 */
export function formatPipeDescription(
  material?: string | null,
  type?: string | null,
): string {
  return [material, type]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

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
 * Looks up a pipe opening size entry by material/type and size, preferring
 * the requested boot variant; falls back to the other variant if only one is
 * configured. The catalog's `pipeMaterial` holds the combined material/type
 * string (e.g. "PVC SDR35"); legacy rows with a separate `pipeType` also
 * match when the requested string equals "<material> <type>".
 */
export function lookupPipeOpeningSize(
  catalog: PipeOpeningSizeEntry[],
  material: string | null | undefined,
  sizeInches: number | null,
  preferBoot: boolean | null = null,
): PipeOpeningSizeEntry | null {
  if (!material || sizeInches == null || !Number.isFinite(sizeInches)) {
    return null;
  }
  const wanted = material.trim().toLowerCase().replace(/\s+/g, " ");
  const matches = catalog.filter((entry) => {
    if (Math.abs(entry.pipeSizeInches - sizeInches) >= EPSILON) {
      return false;
    }
    const mat = entry.pipeMaterial.trim().toLowerCase();
    const combined = `${mat} ${entry.pipeType.trim().toLowerCase()}`.trim();
    return wanted === mat || wanted === combined;
  });
  if (matches.length === 0) {
    return null;
  }
  if (preferBoot != null) {
    const exact = matches.find((entry) => entry.hasBoot === preferBoot);
    if (exact) {
      return exact;
    }
  }
  return matches[0];
}

/** Sump in feet from hole/pipe sizes (pipe centered in hole). */
export function computeDefaultSumpFeet(
  holeDiameterInches: number | null,
  pipeSizeInches: number | null,
): number {
  if (holeDiameterInches == null || pipeSizeInches == null) {
    return 0;
  }
  const sumpInches = (holeDiameterInches - pipeSizeInches) / 2;
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

/** Round wall height DOWN to nearest 6", ensuring brick >= minimum. */
export function computeWallHeightFeet(
  rawAvailableFeet: number,
  minimumBrickInches: number,
): { wallHeightFeet: number; brickFeet: number } {
  const minBrickFeet = inchesToFeet(minimumBrickInches);
  let wallHeightFeet =
    Math.floor(rawAvailableFeet / SIX_INCHES_FEET + EPSILON) * SIX_INCHES_FEET;
  let brickFeet = round4(rawAvailableFeet - wallHeightFeet);

  if (brickFeet < minBrickFeet - EPSILON && wallHeightFeet >= SIX_INCHES_FEET) {
    wallHeightFeet = round4(wallHeightFeet - SIX_INCHES_FEET);
    brickFeet = round4(rawAvailableFeet - wallHeightFeet);
  }

  wallHeightFeet = round4(Math.max(wallHeightFeet, 0));
  brickFeet = round4(Math.max(brickFeet, 0));
  return { wallHeightFeet, brickFeet };
}

function resolveOpenings(
  openings: DrillSheetOpeningInput[],
  catalog: PipeOpeningSizeEntry[],
  templateConnectionType: PipeConnectionType,
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

  return openings.map((opening) => {
    const connectionType =
      opening.connectionType ?? templateConnectionType;
    const wantsBoot = connectionType === "KOR_N_SEAL";
    const match = lookupPipeOpeningSize(
      catalog,
      opening.pipeMaterial,
      opening.pipeSizeInches,
      wantsBoot,
    );
    return {
      ...opening,
      connectionType,
      holeDiameterInches: match?.holeDiameterInches ?? null,
      bootModel: match?.bootModel ?? null,
      pricePerBoot: match?.pricePerBoot ?? null,
      hasBoot: match?.hasBoot ?? wantsBoot,
      pipeWallThicknessInches: match?.pipeWallThicknessInches ?? null,
      isLowInvert:
        opening.invertElevation != null &&
        lowInvert != null &&
        Math.abs(opening.invertElevation - lowInvert) < EPSILON,
      topOfPipeFeet: null,
      bottomOfOpeningFeet: null,
      topOfOpeningFeet: null,
      baseTopToOpeningBottomInches: null,
      containingSectionRole: null,
      sectionBottomToOpeningBottomInches: null,
    };
  });
}

/**
 * Marks each opening with the section its hole penetrates and the drilling
 * offset from that section's bottom ("@ +N" on the sheet; the base measures
 * from the floor). Pure and reusable by the DB detail mapper.
 */
export function annotateOpeningSections(
  openings: ComputedOpening[],
  sections: ComputedSection[],
  floorElevation: number | null,
): ComputedOpening[] {
  if (floorElevation == null || sections.length === 0) {
    return openings;
  }

  const bounds: { role: SectionRole; lo: number; hi: number }[] = [];
  let cursor = floorElevation;
  for (const section of sections) {
    bounds.push({
      role: section.role,
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
    const holder =
      bounds.find(
        (b) => bottom >= b.lo - EPSILON && top <= b.hi + EPSILON,
      ) ??
      bounds.find((b) => bottom >= b.lo - EPSILON && bottom < b.hi - EPSILON) ??
      null;
    if (!holder) {
      return opening;
    }
    return {
      ...opening,
      containingSectionRole: holder.role,
      sectionBottomToOpeningBottomInches: Math.round(
        (bottom - holder.lo) * 12,
      ),
    };
  });
}

/** Standard reinforced precast concrete unit weight. */
export const CONCRETE_DENSITY_LB_PER_CUFT = 150;

export type ComputedWeights = {
  sectionWeightsLb: number[] | null;
  topSlabWeightLb: number | null;
  totalWeightLb: number | null;
};

const NO_WEIGHTS: ComputedWeights = {
  sectionWeightsLb: null,
  topSlabWeightLb: null,
  totalWeightLb: null,
};

/**
 * Piece weights from the mold geometry: rings for wall sections (the base
 * piece adds the monolithic floor slab disc), a disc for the top slab, and
 * each opening deducted from its containing piece as a flat-wall core
 * (π/4 × holeØ² × wall). Simplifications, all small: the top slab counts as
 * a full disc (no casting-access deduction), joint keys and sump are
 * ignored, and the brick course is masonry so it never counts.
 */
export function computeWeights(
  sections: ComputedSection[],
  openings: ComputedOpening[],
  diameter: DiameterConfig,
  template: TemplateConfig,
  topSlabThicknessFeet: number,
  floorElevation: number | null,
): ComputedWeights {
  const wallInches = diameter.wallThicknessInches;
  if (wallInches == null || wallInches <= 0 || sections.length === 0) {
    return NO_WEIGHTS;
  }

  const wallFeet = wallInches / 12;
  const insideDiameter = diameter.insideDiameterFeet;
  const outsideDiameter = insideDiameter + 2 * wallFeet;
  const ringAreaSqFt =
    (Math.PI / 4) * (outsideDiameter ** 2 - insideDiameter ** 2);
  const discAreaSqFt = (Math.PI / 4) * outsideDiameter ** 2;
  const baseSlabFeet = inchesToFeet(template.baseSlabThicknessInches);

  const sectionWeights = sections.map((section) => {
    let volume = ringAreaSqFt * section.heightFeet;
    if (section.role === "BASE") {
      volume += discAreaSqFt * baseSlabFeet;
    }
    return volume * CONCRETE_DENSITY_LB_PER_CUFT;
  });

  // Same elevation bands annotateOpeningSections uses, but by index so a
  // hole comes out of the right piece. Unlocatable holes come out of the
  // base piece — the total stays right either way.
  const bounds: { lo: number; hi: number }[] = [];
  let cursor = floorElevation ?? 0;
  for (const section of sections) {
    bounds.push({ lo: cursor, hi: round4(cursor + section.heightFeet) });
    cursor = round4(cursor + section.heightFeet);
  }
  for (const opening of openings) {
    if (opening.holeDiameterInches == null) {
      continue;
    }
    const holeFeet = opening.holeDiameterInches / 12;
    const deductionLb =
      (Math.PI / 4) * holeFeet ** 2 * wallFeet * CONCRETE_DENSITY_LB_PER_CUFT;
    let index = 0;
    if (floorElevation != null && opening.bottomOfOpeningFeet != null) {
      const bottom = opening.bottomOfOpeningFeet;
      const top = opening.topOfOpeningFeet ?? bottom;
      const exact = bounds.findIndex(
        (b) => bottom >= b.lo - EPSILON && top <= b.hi + EPSILON,
      );
      const partial = bounds.findIndex(
        (b) => bottom >= b.lo - EPSILON && bottom < b.hi - EPSILON,
      );
      index = exact >= 0 ? exact : partial >= 0 ? partial : 0;
    }
    sectionWeights[index] -= deductionLb;
  }

  const sectionWeightsLb = sectionWeights.map((weight) =>
    Math.max(0, Math.round(weight)),
  );
  const topSlabWeightLb = Math.round(
    discAreaSqFt * topSlabThicknessFeet * CONCRETE_DENSITY_LB_PER_CUFT,
  );
  return {
    sectionWeightsLb,
    topSlabWeightLb,
    totalWeightLb:
      sectionWeightsLb.reduce((sum, weight) => sum + weight, 0) +
      topSlabWeightLb,
  };
}

export function getTopOfBottomSlabElevation(
  lowInvertElevation: number | null,
  sumpFeet: number,
): number | null {
  if (lowInvertElevation == null) {
    return null;
  }
  // Matches "Top of Bottom Slab (Floor)" in getStructureElevations.
  return round4(lowInvertElevation - sumpFeet);
}

export function computeBaseTopToOpeningBottomInches(
  bottomOfOpeningFeet: number | null,
  topOfBottomSlabFeet: number | null,
): number | null {
  if (bottomOfOpeningFeet == null || topOfBottomSlabFeet == null) {
    return null;
  }
  return Math.round((bottomOfOpeningFeet - topOfBottomSlabFeet) * 12);
}

function computeOpeningGeometry(
  opening: ComputedOpening,
  sumpFeet: number,
  topOfBottomSlabFeet: number | null,
): ComputedOpening {
  if (opening.invertElevation == null) {
    return opening;
  }
  const pipeSize = opening.pipeSizeInches ?? 0;
  const holeSize = opening.holeDiameterInches ?? pipeSize;
  const pipeWallFt = inchesToFeet(opening.pipeWallThicknessInches ?? 0);

  // Outside top of pipe: invert (inside bottom) + inside diameter + one wall.
  const topOfPipeFeet = round4(
    opening.invertElevation + inchesToFeet(pipeSize) + pipeWallFt,
  );
  // Hole centered on the pipe: hole center = invert + ID/2.
  const holeCenter = opening.invertElevation + inchesToFeet(pipeSize / 2);
  const bottomOfOpeningFeet = round4(holeCenter - inchesToFeet(holeSize / 2));
  const topOfOpeningFeet = round4(holeCenter + inchesToFeet(holeSize / 2));

  let baseTopToOpeningBottomInches: number | null = null;
  if (topOfBottomSlabFeet != null) {
    baseTopToOpeningBottomInches = computeBaseTopToOpeningBottomInches(
      bottomOfOpeningFeet,
      topOfBottomSlabFeet,
    );
  }

  return {
    ...opening,
    topOfPipeFeet,
    bottomOfOpeningFeet,
    topOfOpeningFeet,
    baseTopToOpeningBottomInches,
  };
}

function getTopSlabThicknessFeet(
  template: TemplateConfig,
  diameter: DiameterConfig,
  hasKey: boolean,
): number {
  const full = inchesToFeet(template.topSlabThicknessInches);
  if (hasKey) {
    return round4(full);
  }
  return round4(Math.max(full - diameter.keyHeightFeet, 0));
}

function highestOpeningTop(openings: ComputedOpening[]): number | null {
  let highest: number | null = null;
  for (const opening of openings) {
    if (opening.topOfOpeningFeet != null) {
      if (highest == null || opening.topOfOpeningFeet > highest) {
        highest = opening.topOfOpeningFeet;
      }
    }
  }
  return highest;
}

/** Top of precast wall elevation (below top slab). */
function wallTopElevation(
  floorElevation: number,
  wallHeightFeet: number,
): number {
  return round4(floorElevation + wallHeightFeet);
}

// ---------------------------------------------------------------------------
// Section solver
//
// Splits the wall height into base + riser pours and decides which joints are
// keyed, respecting:
//   - mold max heights (per diameter, from Settings)
//   - base pours in 6" increments; riser pours in 12" increments
//     (6" riser increments only as a last resort)
//   - booted openings: hole fixed (pipe centered), and its top/bottom must
//     clear every joint zone by the template minimums (default 4"). A keyed
//     joint's zone is one key height tall, from the outside joint plane up.
//   - no-boot openings: no clearance minimums, and the hole may slide around
//     the pipe (pipe anywhere inside the hole) — but the hole must still fit
//     within a single section, outside any key zone.
//   - risers containing a hole need 6" of wall above-or-below it (bases are
//     monolithic with the slab and exempt).
//   - joints must mate: keyed-to-keyed or plain-to-plain, so key choice is
//     per joint. Remedy order for conflicts: re-split first, then remove the
//     key at the conflicting joint, then error.
// ---------------------------------------------------------------------------

/** Structural minimum riser wall above-or-below a contained hole (6"). */
const RISER_HOLE_CLEARANCE_FEET = 0.5;
const STANDARD_RISER_STEP_FEET = 1;
const LAST_RESORT_RISER_STEP_FEET = 0.5;
const BASE_STEP_FEET = 0.5;

type SolverHole = {
  label: string;
  hasBoot: boolean;
  holeDiaFeet: number;
  /** Fixed hole span (booted: pipe centered in the hole). */
  fixedSpan: { lo: number; hi: number } | null;
  /** Pipe OD span (no-boot: hole may slide around the pipe). */
  pipeSpan: { lo: number; hi: number } | null;
};

function buildSolverHoles(openings: ComputedOpening[]): SolverHole[] {
  const holes: SolverHole[] = [];
  for (const opening of openings) {
    if (
      opening.invertElevation == null ||
      opening.holeDiameterInches == null
    ) {
      continue;
    }
    const holeDiaFeet = inchesToFeet(opening.holeDiameterInches);
    const idFeet = inchesToFeet(opening.pipeSizeInches ?? 0);
    const wallFeet = inchesToFeet(opening.pipeWallThicknessInches ?? 0);
    const label = opening.label?.trim() || "?";
    if (opening.hasBoot) {
      const center = opening.invertElevation + idFeet / 2;
      holes.push({
        label,
        hasBoot: true,
        holeDiaFeet,
        fixedSpan: {
          lo: center - holeDiaFeet / 2,
          hi: center + holeDiaFeet / 2,
        },
        pipeSpan: null,
      });
    } else {
      holes.push({
        label,
        hasBoot: false,
        holeDiaFeet,
        fixedSpan: null,
        pipeSpan: {
          lo: opening.invertElevation - wallFeet,
          hi: opening.invertElevation + idFeet + wallFeet,
        },
      });
    }
  }
  return holes;
}

type SegmentContext = {
  keyHeightFeet: number;
  marginTopFeet: number;
  marginBottomFeet: number;
  holes: SolverHole[];
};

/**
 * Whether a pour spanning [segLo, segHi] is valid. `lowerKeyed` is the key
 * state of the joint below (null = floor below, i.e. the base pour).
 */
function segmentAllows(
  segLo: number,
  segHi: number,
  role: SectionRole,
  lowerKeyed: boolean | null,
  ctx: SegmentContext,
): boolean {
  const keyInset =
    lowerKeyed == null ? 0 : lowerKeyed ? ctx.keyHeightFeet : 0;
  const clearLo = segLo + keyInset;
  const clearHi = segHi;

  for (const hole of ctx.holes) {
    const span = hole.fixedSpan ?? hole.pipeSpan;
    if (!span) {
      continue;
    }
    // Only holes that vertically overlap this segment are relevant.
    if (span.hi <= segLo + EPSILON || span.lo >= segHi - EPSILON) {
      continue;
    }

    if (hole.fixedSpan) {
      // Booted: fixed hole must clear the joint zone below (plus margin) and
      // the joint above (margin). The floor is not a joint — no lower margin.
      const loBound =
        clearLo + (lowerKeyed == null ? 0 : ctx.marginBottomFeet);
      const hiBound = clearHi - ctx.marginTopFeet;
      if (
        hole.fixedSpan.lo < loBound - EPSILON ||
        hole.fixedSpan.hi > hiBound + EPSILON
      ) {
        return false;
      }
    } else if (hole.pipeSpan) {
      // No-boot: some hole placement containing the pipe must fit in the
      // clear interval (no margins).
      const placeMin = Math.max(clearLo, hole.pipeSpan.hi - hole.holeDiaFeet);
      const placeMax = Math.min(
        hole.pipeSpan.lo,
        clearHi - hole.holeDiaFeet,
      );
      if (placeMin > placeMax + EPSILON) {
        return false;
      }
    }

    if (
      role === "RISER" &&
      segHi - segLo < hole.holeDiaFeet + RISER_HOLE_CLEARANCE_FEET - EPSILON
    ) {
      return false;
    }
  }
  return true;
}

type RiserPlan = {
  /** Riser heights bottom-to-top. */
  heights: number[];
  /** Key state of the joint at the bottom of each riser (index-aligned). */
  jointKeys: boolean[];
  keyRemovals: number;
};

/**
 * DP over cut positions: split [bTop, top] into risers of `step` increments
 * (each ≤ maxRiser), minimizing section count, then key removals. Joints are
 * keyed by default; when `allowUnkey` is set, a joint may be unkeyed to
 * clear a conflict.
 */
function planRisers(
  bTop: number,
  top: number,
  step: number,
  maxRiserFeet: number,
  allowUnkey: boolean,
  ctx: SegmentContext,
): RiserPlan | null {
  const total = round4(top - bTop);
  const count = Math.round(total / step);
  if (Math.abs(count * step - total) > 1e-4 || count <= 0) {
    return null;
  }
  const maxParts = Math.max(1, Math.floor(maxRiserFeet / step + EPSILON));

  type State = { cost: [number, number]; nextIdx: number; keyed: boolean } | null;
  // best[i][k]: from grid index i (joint keyed-state k at position i) to top.
  const memo = new Map<string, State>();

  const posAt = (idx: number) => round4(bTop + idx * step);

  const solve = (idx: number, lowerKeyed: boolean): State => {
    const memoKey = `${idx}|${lowerKeyed ? 1 : 0}`;
    if (memo.has(memoKey)) {
      return memo.get(memoKey) ?? null;
    }
    memo.set(memoKey, null);

    let best: State = null;
    // Prefer taller lower risers: try the largest jump first.
    for (
      let parts = Math.min(maxParts, count - idx);
      parts >= 1;
      parts -= 1
    ) {
      const nextIdx = idx + parts;
      const segLo = posAt(idx);
      const segHi = posAt(nextIdx);
      if (!segmentAllows(segLo, segHi, "RISER", lowerKeyed, ctx)) {
        continue;
      }
      if (nextIdx === count) {
        const candidate: State = { cost: [1, 0], nextIdx, keyed: true };
        if (best == null || compareCost(candidate.cost, best.cost) < 0) {
          best = candidate;
        }
        continue;
      }
      for (const keyed of allowUnkey ? [true, false] : [true]) {
        const rest = solve(nextIdx, keyed);
        if (!rest) {
          continue;
        }
        const cost: [number, number] = [
          1 + rest.cost[0],
          (keyed ? 0 : 1) + rest.cost[1],
        ];
        if (best == null || compareCost(cost, best.cost) < 0) {
          best = { cost, nextIdx, keyed };
        }
      }
    }
    memo.set(memoKey, best);
    return best;
  };

  const tryBottomKeyed = (bottomKeyed: boolean): RiserPlan | null => {
    const start = solve(0, bottomKeyed);
    if (!start) {
      return null;
    }
    const heights: number[] = [];
    const jointKeys: boolean[] = [bottomKeyed];
    let idx = 0;
    let keyed = bottomKeyed;
    let removals = bottomKeyed ? 0 : 1;
    for (;;) {
      const state = solve(idx, keyed);
      if (!state) {
        return null;
      }
      heights.push(round4((state.nextIdx - idx) * step));
      if (state.nextIdx === count) {
        break;
      }
      jointKeys.push(state.keyed);
      if (!state.keyed) {
        removals += 1;
      }
      idx = state.nextIdx;
      keyed = state.keyed;
    }
    return { heights, jointKeys, keyRemovals: removals };
  };

  const keyedPlan = tryBottomKeyed(true);
  if (keyedPlan || !allowUnkey) {
    return keyedPlan;
  }
  return tryBottomKeyed(false);
}

function compareCost(a: [number, number], b: [number, number]): number {
  if (a[0] !== b[0]) {
    return a[0] - b[0];
  }
  return a[1] - b[1];
}

export type SelectSectionsResult = {
  sections: ComputedSection[];
  warnings: string[];
  errorMessage: string | null;
};

/** Greedy split with all keys, used when there is no elevation context. */
function greedySections(
  wallHeightFeet: number,
  maxBase: number,
  maxRiser: number,
): ComputedSection[] {
  const sections: ComputedSection[] = [];
  const baseHeight = Math.min(wallHeightFeet, maxBase);
  let remaining = round4(wallHeightFeet - baseHeight);
  if (baseHeight > EPSILON) {
    sections.push({
      role: "BASE",
      heightFeet: round4(baseHeight),
      hasBottomKey: false,
      hasTopKey: true,
    });
  }
  while (remaining > EPSILON) {
    const riserHeight = Math.min(remaining, maxRiser);
    sections.push({
      role: "RISER",
      heightFeet: round4(riserHeight),
      hasBottomKey: true,
      hasTopKey: true,
    });
    remaining = round4(remaining - riserHeight);
  }
  return sections;
}

/**
 * Split wall height into base + riser sections and choose joint keys.
 * Remedy order for booted-opening conflicts: re-split, then unkey the
 * conflicting joint, then 6" riser increments, then error.
 */
export function selectSections(
  wallHeightFeet: number,
  diameter: DiameterConfig,
  template: TemplateConfig,
  floorElevation: number | null,
  openings: ComputedOpening[],
): SelectSectionsResult {
  const warnings: string[] = [];
  if (wallHeightFeet <= EPSILON) {
    return { sections: [], warnings, errorMessage: null };
  }

  const maxBase = diameter.maxBaseHeightFeet;
  const maxRiser = diameter.maxRiserHeightFeet;

  if (floorElevation == null) {
    return {
      sections: greedySections(wallHeightFeet, maxBase, maxRiser),
      warnings,
      errorMessage: null,
    };
  }

  const ctx: SegmentContext = {
    keyHeightFeet: diameter.keyHeightFeet,
    marginTopFeet: inchesToFeet(template.openingToJointMinTopInches),
    marginBottomFeet: inchesToFeet(template.openingToJointMinBottomInches),
    holes: buildSolverHoles(openings),
  };
  const top = round4(floorElevation + wallHeightFeet);

  // Candidate base heights, largest first (fewest sections preferred).
  const baseCandidates: number[] = [];
  const largestBase = round4(
    Math.floor(Math.min(wallHeightFeet, maxBase) / BASE_STEP_FEET + EPSILON) *
      BASE_STEP_FEET,
  );
  for (
    let b = largestBase;
    b >= BASE_STEP_FEET - EPSILON;
    b = round4(b - BASE_STEP_FEET)
  ) {
    baseCandidates.push(b);
  }

  type Attempt = { riserStep: number; allowUnkey: boolean };
  const attempts: Attempt[] = [
    { riserStep: STANDARD_RISER_STEP_FEET, allowUnkey: false },
    { riserStep: STANDARD_RISER_STEP_FEET, allowUnkey: true },
    { riserStep: LAST_RESORT_RISER_STEP_FEET, allowUnkey: false },
    { riserStep: LAST_RESORT_RISER_STEP_FEET, allowUnkey: true },
  ];

  for (const attempt of attempts) {
    let best:
      | { sections: ComputedSection[]; keyRemovals: number; sectionCount: number }
      | null = null;

    for (const baseHeight of baseCandidates) {
      const bTop = round4(floorElevation + baseHeight);
      const riserTotal = round4(wallHeightFeet - baseHeight);

      if (riserTotal <= EPSILON) {
        // Base-only solution: top joint is the top-slab joint.
        if (
          segmentAllows(floorElevation, top, "BASE", null, ctx)
        ) {
          const sections: ComputedSection[] = [
            {
              role: "BASE",
              heightFeet: round4(baseHeight),
              hasBottomKey: false,
              hasTopKey: true,
            },
          ];
          if (best == null || 1 < best.sectionCount) {
            best = { sections, keyRemovals: 0, sectionCount: 1 };
          }
        }
        continue;
      }

      if (!segmentAllows(floorElevation, bTop, "BASE", null, ctx)) {
        continue;
      }

      const plan = planRisers(
        bTop,
        top,
        attempt.riserStep,
        maxRiser,
        attempt.allowUnkey,
        ctx,
      );
      if (!plan) {
        continue;
      }

      const sections: ComputedSection[] = [
        {
          role: "BASE",
          heightFeet: round4(baseHeight),
          hasBottomKey: false,
          hasTopKey: plan.jointKeys[0] ?? true,
        },
      ];
      plan.heights.forEach((height, index) => {
        sections.push({
          role: "RISER",
          heightFeet: height,
          hasBottomKey: plan.jointKeys[index] ?? true,
          hasTopKey: plan.jointKeys[index + 1] ?? true,
        });
      });

      const candidate = {
        sections,
        keyRemovals: plan.keyRemovals,
        sectionCount: sections.length,
      };
      if (
        best == null ||
        candidate.sectionCount < best.sectionCount ||
        (candidate.sectionCount === best.sectionCount &&
          candidate.keyRemovals < best.keyRemovals)
      ) {
        best = candidate;
      }
    }

    if (best) {
      if (best.keyRemovals > 0) {
        const unkeyed: string[] = [];
        let cumulative = floorElevation;
        for (let i = 0; i < best.sections.length - 1; i += 1) {
          cumulative = round4(cumulative + best.sections[i].heightFeet);
          if (!best.sections[i].hasTopKey) {
            unkeyed.push(`${cumulative.toFixed(2)}'`);
          }
        }
        warnings.push(
          `Key removed at joint${unkeyed.length === 1 ? "" : "s"} ${unkeyed.join(", ")} to clear a pipe opening.`,
        );
      }
      if (attempt.riserStep === LAST_RESORT_RISER_STEP_FEET) {
        warnings.push(
          'Riser heights use 6" increments (last resort) to clear pipe openings.',
        );
      }
      return { sections: best.sections, warnings, errorMessage: null };
    }
  }

  // Remedy (c): nothing fits — report and fall back to the greedy split so
  // the sheet still renders something reviewable.
  return {
    sections: greedySections(wallHeightFeet, maxBase, maxRiser),
    warnings,
    errorMessage:
      "No base/riser combination clears every pipe opening, even after removing keys. Check opening inverts, hole sizes, and mold heights.",
  };
}

function computePricing(
  wallHeightFeet: number,
  diameter: DiameterConfig,
  openings: ComputedOpening[],
): { wallPrice: number; bootsPrice: number; totalPrice: number } {
  const wallPrice = round2(
    diameter.basePrice + wallHeightFeet * diameter.wallPricePerFoot,
  );
  let bootsPrice = 0;
  for (const opening of openings) {
    if (
      opening.connectionType === "KOR_N_SEAL" &&
      opening.pricePerBoot != null
    ) {
      bootsPrice += opening.pricePerBoot;
    }
  }
  bootsPrice = round2(bootsPrice);
  return {
    wallPrice,
    bootsPrice,
    totalPrice: round2(wallPrice + bootsPrice),
  };
}

/**
 * Computes a full drill sheet from rim/invert inputs.
 */
export function computeDrillSheet(input: DrillSheetInput): DrillSheetResult {
  const warnings: string[] = [];
  const template = input.template;
  const diameter = input.diameter;
  const castingHeightFeet = input.castingHeightFeet ?? 0;

  let openings = resolveOpenings(
    input.openings,
    input.pipeOpeningSizes,
    template.connectionType,
  );

  const lowInvertOpening = openings.find((o) => o.isLowInvert);
  const lowInvertElevation = lowInvertOpening?.invertElevation ?? null;

  for (const opening of openings) {
    if (
      opening.pipeSizeInches != null &&
      opening.pipeMaterial &&
      opening.holeDiameterInches == null
    ) {
      warnings.push(
        `No pipe opening size configured for ${opening.pipeSizeInches}" ${opening.pipeMaterial}.`,
      );
    }
  }

  let sumpFeet = 0;
  if (template.sumpMode === "FIXED" && template.sumpFixedInches != null) {
    sumpFeet = round4(inchesToFeet(template.sumpFixedInches));
  } else if (lowInvertOpening) {
    sumpFeet = computeDefaultSumpFeet(
      lowInvertOpening.holeDiameterInches,
      lowInvertOpening.pipeSizeInches,
    );
  }

  const invertToTopFeet = computeInvertToTopFeet(
    input.rimElevation,
    lowInvertElevation,
  );

  const minBrickFeet = inchesToFeet(template.minimumBrickInches);

  const computeHeights = (hasKey: boolean) => {
    const topSlabThicknessFeet = getTopSlabThicknessFeet(
      template,
      diameter,
      hasKey,
    );
    if (invertToTopFeet == null) {
      return {
        hasKey,
        topSlabThicknessFeet,
        rawAvailableFeet: null as number | null,
        wallHeightFeet: 0,
        brickFeet: 0,
      };
    }
    const rawAvailableFeet = round4(
      invertToTopFeet -
        castingHeightFeet -
        topSlabThicknessFeet +
        sumpFeet,
    );
    const { wallHeightFeet, brickFeet } = computeWallHeightFeet(
      rawAvailableFeet,
      template.minimumBrickInches,
    );
    return {
      hasKey,
      topSlabThicknessFeet,
      rawAvailableFeet,
      wallHeightFeet,
      brickFeet,
    };
  };

  let hasKey = true;
  let heights = computeHeights(true);
  let errorMessage: string | null = null;

  const floorElevation =
    lowInvertElevation != null ? round4(lowInvertElevation - sumpFeet) : null;
  const topOfBottomSlabFeet = getTopOfBottomSlabElevation(
    lowInvertElevation,
    sumpFeet,
  );

  openings = openings.map((opening) =>
    computeOpeningGeometry(opening, sumpFeet, topOfBottomSlabFeet),
  );

  const highestOpening = highestOpeningTop(openings);
  const minTopFt = inchesToFeet(template.openingToJointMinTopInches);

  if (
    floorElevation != null &&
    highestOpening != null &&
    heights.rawAvailableFeet != null
  ) {
    const wallTop = wallTopElevation(floorElevation, heights.wallHeightFeet);
    if (wallTop - highestOpening < minTopFt - EPSILON) {
      hasKey = false;
      heights = computeHeights(false);
      const wallTopNoKey = wallTopElevation(
        floorElevation,
        heights.wallHeightFeet,
      );
      if (wallTopNoKey - highestOpening < minTopFt - EPSILON) {
        errorMessage = `Highest pipe opening top (${highestOpening.toFixed(2)}') is too close to the top of the wall (${wallTopNoKey.toFixed(2)}'). Minimum clearance is ${template.openingToJointMinTopInches}".`;
      }
    }
  }

  if (heights.brickFeet < minBrickFeet - EPSILON) {
    warnings.push(
      `Brick (${heights.brickFeet.toFixed(2)}') is below the ${minBrickFeet.toFixed(2)}' minimum.`,
    );
  }

  const {
    sections,
    warnings: sectionWarnings,
    errorMessage: sectionError,
  } = selectSections(
    heights.wallHeightFeet,
    diameter,
    template,
    floorElevation,
    openings,
  );
  warnings.push(...sectionWarnings);
  if (sectionError && !errorMessage) {
    errorMessage = sectionError;
  }

  // The topmost section's top joint is the top-slab joint; mirror its key.
  if (sections.length > 0) {
    sections[sections.length - 1] = {
      ...sections[sections.length - 1],
      hasTopKey: hasKey,
    };
  }

  openings = annotateOpeningSections(openings, sections, floorElevation);

  if (sections.length === 0 && invertToTopFeet != null && heights.wallHeightFeet > EPSILON) {
    warnings.push("No sections could be configured for this wall height.");
  }

  const pricing = computePricing(heights.wallHeightFeet, diameter, openings);

  const weights = computeWeights(
    sections,
    openings,
    diameter,
    template,
    heights.topSlabThicknessFeet,
    floorElevation,
  );
  if (
    weights.totalWeightLb == null &&
    sections.length > 0 &&
    (diameter.wallThicknessInches == null ||
      diameter.wallThicknessInches <= 0)
  ) {
    warnings.push(
      "No wall thickness on this mold — weights unavailable. Set it in Settings → Structure Molds.",
    );
  }

  const baseSlabThicknessFeet = round4(
    inchesToFeet(template.baseSlabThicknessInches),
  );

  const totalHeightFeet =
    invertToTopFeet != null
      ? round4(
          heights.wallHeightFeet +
            heights.topSlabThicknessFeet +
            castingHeightFeet +
            inchesToFeet(template.baseSlabThicknessInches),
        )
      : null;

  return {
    rimElevation: input.rimElevation,
    lowInvertElevation,
    invertToTopFeet,
    castingHeightFeet: round4(castingHeightFeet),
    topSlabThicknessFeet: round4(heights.topSlabThicknessFeet),
    sumpFeet,
    rawAvailableFeet: heights.rawAvailableFeet,
    wallHeightFeet: round4(heights.wallHeightFeet),
    brickFeet: round4(heights.brickFeet),
    hasKey,
    keyHeightFeet: diameter.keyHeightFeet,
    totalHeightFeet,
    baseSlabThicknessFeet,
    sections,
    openings,
    sectionWeightsLb: weights.sectionWeightsLb,
    topSlabWeightLb: weights.topSlabWeightLb,
    totalWeightLb: weights.totalWeightLb,
    wallPrice: pricing.wallPrice,
    bootsPrice: pricing.bootsPrice,
    totalPrice: pricing.totalPrice,
    errorMessage,
    warnings,
  };
}

export type StructureElevation = {
  key: string;
  label: string;
  elevation: number;
};

/**
 * Ordered elevation ladder from rim down to bottom of bottom slab,
 * including each precast section joint within the wall.
 */
export function getStructureElevations(
  result: DrillSheetResult,
): StructureElevation[] {
  if (result.rimElevation == null) {
    return [];
  }

  const entries: StructureElevation[] = [];
  let current = round4(result.rimElevation);

  entries.push({ key: "rim", label: "Rim Elevation", elevation: current });

  current = round4(current - result.castingHeightFeet);
  entries.push({
    key: "casting",
    label: "Bottom of Casting / Top of Brick",
    elevation: current,
  });

  current = round4(current - result.brickFeet);
  entries.push({
    key: "top-slab-top",
    label: "Top of Top Slab",
    elevation: current,
  });

  current = round4(current - result.topSlabThicknessFeet);
  entries.push({
    key: "top-slab-bottom",
    label: "Bottom of Top Slab (Joint / Top of Wall)",
    elevation: current,
  });

  const topOfWall = current;
  const reversedSections = [...result.sections].reverse();

  for (let i = 0; i < reversedSections.length - 1; i += 1) {
    const above = reversedSections[i];
    const below = reversedSections[i + 1];
    current = round4(current - above.heightFeet);
    const aboveLabel = above.role === "BASE" ? "Base" : "Riser";
    const belowLabel = below.role === "BASE" ? "Base" : "Riser";
    entries.push({
      key: `joint-${i}`,
      label: `Joint ${i + 1} (${aboveLabel} ${formatFeetInches(above.heightFeet)} / ${belowLabel} ${formatFeetInches(below.heightFeet)})`,
      elevation: current,
    });
  }

  if (
    result.lowInvertElevation != null &&
    result.sumpFeet != null
  ) {
    const floor = getTopOfBottomSlabElevation(
      result.lowInvertElevation,
      result.sumpFeet,
    );
    if (floor != null) {
      entries.push({
        key: "floor",
        label: "Top of Bottom Slab (Floor)",
        elevation: floor,
      });

      if (
        result.baseSlabThicknessFeet != null &&
        result.baseSlabThicknessFeet > EPSILON
      ) {
        entries.push({
          key: "bottom-slab",
          label: "Bottom of Bottom Slab",
          elevation: round4(floor - result.baseSlabThicknessFeet),
        });
      }
    }
  } else if (reversedSections.length > 0) {
    const floorFromWall = round4(
      topOfWall -
        reversedSections.reduce((sum, section) => sum + section.heightFeet, 0),
    );
    entries.push({
      key: "floor",
      label: "Top of Bottom Slab (Floor)",
      elevation: floorFromWall,
    });
    if (
      result.baseSlabThicknessFeet != null &&
      result.baseSlabThicknessFeet > EPSILON
    ) {
      entries.push({
        key: "bottom-slab",
        label: "Bottom of Bottom Slab",
        elevation: round4(floorFromWall - result.baseSlabThicknessFeet),
      });
    }
  }

  return entries;
}

export type StructureDimension = {
  key: string;
  label: string;
  feet: number;
};

/** Top-to-bottom component heights/thicknesses for the drill sheet dimensions list. */
export function getStructureDimensions(
  result: DrillSheetResult,
): StructureDimension[] {
  const dims: StructureDimension[] = [];
  const push = (key: string, label: string, feet: number | null | undefined) => {
    dims.push({ key, label, feet: feet ?? 0 });
  };

  push("casting", "Casting", result.castingHeightFeet);
  push("brick", "Brick", result.brickFeet);
  push("top-slab", "Top Slab", result.topSlabThicknessFeet);

  const reversed = [...result.sections].reverse();
  reversed.forEach((section, i) => {
    const role = section.role === "BASE" ? "Base" : "Riser";
    push(`section-${i}`, role, section.heightFeet);
  });

  push("base-slab", "Base Slab", result.baseSlabThicknessFeet);
  return dims;
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

/** Like formatFeetInches but drops the feet part when under 1 ft: 0.667 -> 8", 4.5 -> 4'-6". */
export function formatFeetInchesShort(feet: number | null | undefined): string {
  const full = formatFeetInches(feet);
  if (full === "—") {
    return full;
  }
  return full.startsWith("0'-") ? full.slice(3) : full;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}
