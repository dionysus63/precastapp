export type DrainRingStyle = "DRAIN" | "SANITARY" | "SOLID";

export const DRAIN_RING_SANITARY_DIAMETERS = [8, 10] as const;

export const drainRingStyleFormOptions: {
  value: DrainRingStyle;
  label: string;
}[] = [
  { value: "DRAIN", label: "Drain" },
  { value: "SANITARY", label: "Sanitary" },
  { value: "SOLID", label: "Solid" },
];

export function diameterSupportsSanitaryDrainRing(diameter: number): boolean {
  return DRAIN_RING_SANITARY_DIAMETERS.includes(
    diameter as (typeof DRAIN_RING_SANITARY_DIAMETERS)[number],
  );
}

export function getDrainRingStyleOptionsForDiameter(diameter: number): {
  value: DrainRingStyle;
  label: string;
}[] {
  return drainRingStyleFormOptions.filter((option) => {
    if (option.value === "SANITARY") {
      return diameterSupportsSanitaryDrainRing(diameter);
    }
    return true;
  });
}

export function parseDrainRingStyle(value: string): DrainRingStyle {
  const normalized = value.trim().toUpperCase();
  if (normalized === "SANITARY" || normalized === "SAN") {
    return "SANITARY";
  }
  if (normalized === "SOLID" || normalized === "SOL") {
    return "SOLID";
  }
  if (normalized === "DRAIN" || normalized === "STANDARD") {
    return "DRAIN";
  }
  return "DRAIN";
}

/** Accepts DRAIN/SAN/SOL style values plus legacy Yes/No and STANDARD. */
export function parseBulkRingStyle(value: string): DrainRingStyle {
  const trimmed = value.trim();
  if (!trimmed) {
    return "DRAIN";
  }

  const lower = trimmed.toLowerCase();
  if (lower === "yes") {
    return "SANITARY";
  }
  if (lower === "no") {
    return "DRAIN";
  }

  return parseDrainRingStyle(trimmed);
}

export function isRecognizedBulkRingStyle(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }

  const normalized = trimmed.toUpperCase();
  if (
    normalized === "DRAIN" ||
    normalized === "SAN" ||
    normalized === "SANITARY" ||
    normalized === "SOL" ||
    normalized === "SOLID" ||
    normalized === "STANDARD"
  ) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  return lower === "yes" || lower === "no";
}

export function formatRingQuoteItemCode(
  diameter: number,
  style: DrainRingStyle,
): string {
  const styleSuffix =
    style === "SANITARY" ? "SAN" : style === "SOLID" ? "SOL" : "DRAIN";
  return `R-${diameter}-${styleSuffix}`;
}

export function parseSanitaryYesNo(value: string): DrainRingStyle {
  const normalized = value.trim().toLowerCase();
  return normalized === "yes" ? "SANITARY" : "DRAIN";
}

export function formatDrainRingStyleLabel(style: DrainRingStyle): string {
  if (style === "SANITARY") {
    return "Sanitary";
  }
  if (style === "SOLID") {
    return "Solid";
  }
  return "Drain";
}

export function assertSanitaryDrainRingAllowed(
  diameter: number | null | undefined,
  style: DrainRingStyle,
  context: string,
): void {
  if (style !== "SANITARY") {
    return;
  }
  if (diameter == null || !diameterSupportsSanitaryDrainRing(diameter)) {
    throw new Error(
      `${context}: Sanitary rings are only available for 8' and 10' diameters.`,
    );
  }
}

export function formatDrainRingPoolDescription(input: {
  poolCount: number;
  poolHeight: number;
  diameter: number;
  style?: DrainRingStyle;
}): string {
  const styleSuffix =
    input.style === "SANITARY"
      ? ", sanitary"
      : input.style === "SOLID"
        ? ", solid"
        : "";
  return `${input.poolCount} pool${input.poolCount === 1 ? "" : "s"} @ ${input.poolHeight}' (${input.diameter}' dia${styleSuffix})`;
}
