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
  holeDiameterInches: number;
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
};

export type ComputedOpening = DrillSheetOpeningInput & {
  holeDiameterInches: number | null;
  bootModel: string | null;
  pricePerBoot: number | null;
  isLowInvert: boolean;
  topOfPipeFeet: number | null;
  bottomOfOpeningFeet: number | null;
  topOfOpeningFeet: number | null;
  baseTopToOpeningBottomInches: number | null;
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
  totalHeightFeet: number | null;
  baseSlabThicknessFeet: number | null;
  sections: ComputedSection[];
  openings: ComputedOpening[];
  wallPrice: number;
  bootsPrice: number;
  totalPrice: number;
  errorMessage: string | null;
  warnings: string[];
};

const EPSILON = 1e-6;
const SIX_INCHES_FEET = 0.5;

function round4(value: number): number {
  return Math.round((value + EPSILON) * 10000) / 10000;
}

function round2(value: number): number {
  return Math.round((value + EPSILON) * 100) / 100;
}

function inchesToFeet(inches: number): number {
  return inches / 12;
}

/** Looks up a pipe opening size entry by material, size, and type. */
export function lookupPipeOpeningSize(
  catalog: PipeOpeningSizeEntry[],
  material: string | null | undefined,
  sizeInches: number | null,
  type: string | null | undefined,
): PipeOpeningSizeEntry | null {
  if (
    !material ||
    sizeInches == null ||
    !type ||
    !Number.isFinite(sizeInches)
  ) {
    return null;
  }
  const mat = material.trim().toLowerCase();
  const typ = type.trim().toLowerCase();
  return (
    catalog.find(
      (entry) =>
        entry.pipeMaterial.trim().toLowerCase() === mat &&
        Math.abs(entry.pipeSizeInches - sizeInches) < EPSILON &&
        entry.pipeType.trim().toLowerCase() === typ,
    ) ?? null
  );
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
    const match = lookupPipeOpeningSize(
      catalog,
      opening.pipeMaterial,
      opening.pipeSizeInches,
      opening.pipeType,
    );
    const connectionType =
      opening.connectionType ?? templateConnectionType;
    return {
      ...opening,
      connectionType,
      holeDiameterInches: match?.holeDiameterInches ?? null,
      bootModel: match?.bootModel ?? null,
      pricePerBoot: match?.pricePerBoot ?? null,
      isLowInvert:
        opening.invertElevation != null &&
        lowInvert != null &&
        Math.abs(opening.invertElevation - lowInvert) < EPSILON,
      topOfPipeFeet: null,
      bottomOfOpeningFeet: null,
      topOfOpeningFeet: null,
      baseTopToOpeningBottomInches: null,
    };
  });
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
  wallThicknessInches: number,
  sumpFeet: number,
  topOfBottomSlabFeet: number | null,
): ComputedOpening {
  if (opening.invertElevation == null) {
    return opening;
  }
  const pipeSize = opening.pipeSizeInches ?? 0;
  const holeSize = opening.holeDiameterInches ?? pipeSize;
  const wallFt = inchesToFeet(wallThicknessInches);

  const topOfPipeFeet = round4(
    opening.invertElevation + inchesToFeet(pipeSize / 2) + wallFt,
  );
  const bottomOfOpeningFeet = round4(opening.invertElevation - sumpFeet);
  const topOfOpeningFeet = round4(
    opening.invertElevation + inchesToFeet(holeSize / 2),
  );

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

function openingViolatesJointClearance(
  opening: ComputedOpening,
  jointElevation: number,
  minTopInches: number,
  minBottomInches: number,
): boolean {
  if (
    opening.topOfOpeningFeet == null ||
    opening.bottomOfOpeningFeet == null
  ) {
    return false;
  }
  const minTopFt = inchesToFeet(minTopInches);
  const minBottomFt = inchesToFeet(minBottomInches);
  const distFromTop = jointElevation - opening.topOfOpeningFeet;
  const distFromBottom = opening.bottomOfOpeningFeet - jointElevation;
  if (distFromTop >= 0 && distFromTop < minTopFt - EPSILON) {
    return true;
  }
  if (distFromBottom >= 0 && distFromBottom < minBottomFt - EPSILON) {
    return true;
  }
  return false;
}

/** Split wall height into base + riser sections respecting mold limits and joint clearance. */
export function selectSections(
  wallHeightFeet: number,
  diameter: DiameterConfig,
  template: TemplateConfig,
  floorElevation: number | null,
  openings: ComputedOpening[],
): { sections: ComputedSection[]; warnings: string[] } {
  const warnings: string[] = [];
  if (wallHeightFeet <= EPSILON) {
    return { sections: [], warnings };
  }

  const maxBase = diameter.maxBaseHeightFeet;
  const maxRiser = diameter.maxRiserHeightFeet;

  let baseHeight = Math.min(wallHeightFeet, maxBase);
  let remaining = round4(wallHeightFeet - baseHeight);
  const sections: ComputedSection[] = [];

  if (baseHeight > EPSILON) {
    sections.push({ role: "BASE", heightFeet: round4(baseHeight) });
  }

  while (remaining > EPSILON) {
    const riserHeight = Math.min(remaining, maxRiser);
    sections.push({ role: "RISER", heightFeet: round4(riserHeight) });
    remaining = round4(remaining - riserHeight);
  }

  if (floorElevation != null && sections.length > 1) {
    let cumulative = 0;
    for (let i = 0; i < sections.length - 1; i += 1) {
      cumulative = round4(cumulative + sections[i].heightFeet);
      const jointElev = round4(floorElevation + cumulative);
      for (const opening of openings) {
        if (
          openingViolatesJointClearance(
            opening,
            jointElev,
            template.openingToJointMinTopInches,
            template.openingToJointMinBottomInches,
          )
        ) {
          warnings.push(
            `Section joint at ${jointElev.toFixed(2)}' may be too close to opening ${opening.label ?? ""}.`,
          );
        }
      }
    }
  }

  if (remaining > EPSILON) {
    warnings.push(
      `Could not fit all wall height into sections (remaining ${remaining.toFixed(2)}').`,
    );
  }

  return { sections, warnings };
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
      (opening.pipeMaterial || opening.pipeType) &&
      opening.holeDiameterInches == null
    ) {
      warnings.push(
        `No pipe opening size configured for ${opening.pipeMaterial ?? ""} ${opening.pipeSizeInches}" ${opening.pipeType ?? ""}.`,
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
    computeOpeningGeometry(
      opening,
      template.wallThicknessInches,
      sumpFeet,
      topOfBottomSlabFeet,
    ),
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

  const { sections, warnings: sectionWarnings } = selectSections(
    heights.wallHeightFeet,
    diameter,
    template,
    floorElevation,
    openings,
  );
  warnings.push(...sectionWarnings);

  if (sections.length === 0 && invertToTopFeet != null && heights.wallHeightFeet > EPSILON) {
    warnings.push("No sections could be configured for this wall height.");
  }

  const pricing = computePricing(heights.wallHeightFeet, diameter, openings);

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
    totalHeightFeet,
    baseSlabThicknessFeet,
    sections,
    openings,
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
