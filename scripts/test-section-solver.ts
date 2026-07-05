import {
  type ComputedOpening,
  type DiameterConfig,
  type TemplateConfig,
  selectSections,
} from "@/lib/drill-sheet";

function diameter(overrides: Partial<DiameterConfig> = {}): DiameterConfig {
  return {
    insideDiameterFeet: 4,
    maxBaseHeightFeet: 8,
    maxRiserHeightFeet: 4,
    keyHeightFeet: 4 / 12,
    wallPricePerFoot: 0,
    basePrice: 0,
    ...overrides,
  };
}

function template(overrides: Partial<TemplateConfig> = {}): TemplateConfig {
  return {
    wallThicknessInches: 8,
    baseSlabThicknessInches: 8,
    topSlabThicknessInches: 16,
    minimumBrickInches: 4,
    connectionType: "KOR_N_SEAL",
    sumpMode: "DEFAULT",
    sumpFixedInches: null,
    openingToJointMinTopInches: 4,
    openingToJointMinBottomInches: 4,
    ...overrides,
  };
}

/** Builds a ComputedOpening whose hole is centered at `holeCenterFeet`. */
function opening(
  label: string,
  holeCenterFeet: number,
  holeDiaInches: number,
  pipeIdInches: number,
  hasBoot: boolean,
): ComputedOpening {
  return {
    label,
    pipeMaterial: "PVC",
    pipeSizeInches: pipeIdInches,
    pipeType: "SDR35",
    invertElevation: holeCenterFeet - pipeIdInches / 24,
    angleDegrees: 90,
    connectionType: hasBoot ? "KOR_N_SEAL" : "GROUTED",
    holeDiameterInches: holeDiaInches,
    bootModel: hasBoot ? "106" : null,
    pricePerBoot: null,
    hasBoot,
    pipeWallThicknessInches: 0.5,
    isLowInvert: false,
    topOfPipeFeet: null,
    bottomOfOpeningFeet: null,
    topOfOpeningFeet: null,
    baseTopToOpeningBottomInches: null,
  };
}

function fmt(sections: ReturnType<typeof selectSections>["sections"]): string {
  return sections
    .map(
      (s) =>
        `${s.role} ${s.heightFeet}' (${s.hasBottomKey ? "bK" : "--"}/${s.hasTopKey ? "tK" : "--"})`,
    )
    .join(" | ");
}

function expect(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(`FAILED: ${message}`);
  }
  console.log(`  ok: ${message}`);
}

function sum(sections: { heightFeet: number }[]): number {
  return sections.reduce((total, section) => total + section.heightFeet, 0);
}

// T1: no openings, wall fits in one base pour.
{
  console.log("T1: single base, no openings");
  const r = selectSections(8, diameter(), template(), 0, []);
  console.log(`  -> ${fmt(r.sections)}`);
  expect(r.errorMessage == null, "no error");
  expect(r.sections.length === 1 && r.sections[0].role === "BASE", "one base");
  expect(Math.abs(sum(r.sections) - 8) < 1e-6, "heights sum to wall");
}

// T2: booted hole across the default base-top joint forces a re-split,
// keys stay everywhere.
{
  console.log("T2: re-split around booted hole (remedy a)");
  // Wall 12': default would be base 8 + riser 4 with joint at 8.0'.
  // Hole spans [7.17, 8.83] (20" hole) across that joint.
  const r = selectSections(
    12,
    diameter(),
    template(),
    0,
    [opening("B", 8.0, 20, 12, true)],
  );
  console.log(`  -> ${fmt(r.sections)}  warnings: ${r.warnings.join("; ")}`);
  expect(r.errorMessage == null, "no error");
  expect(
    r.sections.every((s) => s.hasTopKey && (s.role === "BASE" || s.hasBottomKey)),
    "all joints keyed",
  );
  expect(Math.abs(sum(r.sections) - 12) < 1e-6, "heights sum to wall");
  // No joint may fall inside the forbidden band around the hole.
  let cumulative = 0;
  for (let i = 0; i < r.sections.length - 1; i += 1) {
    cumulative += r.sections[i].heightFeet;
    const zoneTop = cumulative + 4 / 12;
    expect(
      zoneTop + 4 / 12 <= 7.1667 + 1e-6 || cumulative - 4 / 12 >= 8.8333 - 1e-6,
      `joint at ${cumulative}' clears hole`,
    );
  }
}

// T3: cascade to key removal + 6" risers (remedies b + last resort).
// maxRiser 2 and a hole band that blocks every 12"-grid joint keyed.
{
  console.log("T3: key removal + half-foot risers (remedy cascade)");
  const r = selectSections(
    10,
    diameter({ maxRiserHeightFeet: 2 }),
    template(),
    0,
    [opening("B", 7.5, 12, 8, true)], // hole [7.0, 8.0]
  );
  console.log(`  -> ${fmt(r.sections)}  warnings: ${r.warnings.join("; ")}`);
  expect(r.errorMessage == null, "no error");
  expect(
    r.warnings.some((w) => w.includes("Key removed")),
    "reports key removal",
  );
  expect(Math.abs(sum(r.sections) - 10) < 1e-6, "heights sum to wall");
}

// T4: riser needs hole + 6": with maxRiser 2 a 20" no-boot hole in the riser
// zone cannot fit anywhere -> error; with maxRiser 3 it solves.
{
  console.log("T4: riser 6\" rule");
  const tight = selectSections(
    12,
    diameter({ maxRiserHeightFeet: 2 }),
    template(),
    0,
    [opening("C", 9.0, 20, 16, false)],
  );
  console.log(`  tight -> error: ${tight.errorMessage}`);
  expect(tight.errorMessage != null, "maxRiser 2 cannot fit 20\" hole + 6\"");

  const roomy = selectSections(
    12,
    diameter({ maxRiserHeightFeet: 3 }),
    template(),
    0,
    [opening("C", 9.0, 20, 16, false)],
  );
  console.log(`  roomy -> ${fmt(roomy.sections)}`);
  expect(roomy.errorMessage == null, "maxRiser 3 solves");
  const holding = roomy.sections.find((s, i) => {
    const lo = roomy.sections.slice(0, i).reduce((t, x) => t + x.heightFeet, 0);
    return lo <= 8.1667 + 1e-6 && lo + s.heightFeet >= 9.8333 - 1e-6;
  });
  expect(
    holding != null &&
      (holding.role === "BASE" ||
        holding.heightFeet >= 20 / 12 + 0.5 - 1e-6),
    "hole-bearing riser is at least hole + 6\"",
  );
}

// T5: same geometry as T2 but no-boot -> no clearance needed, default split OK.
{
  console.log("T5: no-boot hole may sit close to a joint");
  const r = selectSections(
    12,
    diameter(),
    template(),
    0,
    [opening("B", 8.9, 20, 12, false)],
  );
  console.log(`  -> ${fmt(r.sections)}`);
  expect(r.errorMessage == null, "no error");
  expect(
    r.sections.length === 2 &&
      r.sections[0].heightFeet === 8 &&
      r.sections[1].heightFeet === 4,
    "keeps default base 8 + riser 4 split",
  );
}

console.log("\nAll section solver checks passed.");
