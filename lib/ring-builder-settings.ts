import type { DrainRingStyle } from "@/lib/drain-ring-utils";
import {
  drainRingStyleFormOptions,
  formatDrainRingStyleLabel,
  parseDrainRingStyle,
} from "@/lib/drain-ring-utils";

/** Diameters offered in the quote Ring Builder (not the global product catalog). */
export const ringBuilderDiameterFeetOptions = [8, 10, 12] as const;

/** Sanitary style is only offered at these diameters in the Ring Builder. */
export const ringBuilderSanitaryDiameters = [8, 10, 12] as const;

export function diameterSupportsRingBuilderSanitary(diameter: number): boolean {
  return ringBuilderSanitaryDiameters.includes(
    diameter as (typeof ringBuilderSanitaryDiameters)[number],
  );
}

export function formatRingBuilderSanitaryDiametersLabel(): string {
  const feet = ringBuilderSanitaryDiameters.map((diameter) => `${diameter}'`);
  if (feet.length <= 1) {
    return feet[0] ?? "";
  }
  if (feet.length === 2) {
    return `${feet[0]} and ${feet[1]}`;
  }
  return `${feet.slice(0, -1).join(", ")}, and ${feet[feet.length - 1]}`;
}

export function getRingBuilderStyleOptionsForDiameter(diameter: number): {
  value: DrainRingStyle;
  label: string;
}[] {
  return drainRingStyleFormOptions.filter((option) => {
    if (option.value === "SOLID") {
      return false;
    }
    if (option.value === "SANITARY") {
      return diameterSupportsRingBuilderSanitary(diameter);
    }
    return true;
  });
}

export type RingSlabMapping = {
  diameterFeet: number;
  style: DrainRingStyle;
  otherSubcategories: string[];
  defaultPricePerFoot: number;
};

export type RingBuilderConfig = RingSlabMapping[];

export const DEFAULT_RING_BUILDER_CONFIG: RingBuilderConfig = [];

function normalizeSubcategoryList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const items: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push(trimmed);
  }

  return items;
}

function parseDefaultPricePerFoot(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function parseOtherSubcategoriesFromEntry(entry: object): string[] {
  if ("otherSubcategories" in entry) {
    return normalizeSubcategoryList(entry.otherSubcategories);
  }

  const legacyTop =
    "topSubcategories" in entry
      ? normalizeSubcategoryList(entry.topSubcategories)
      : [];
  const legacyBottom =
    "bottomSubcategories" in entry
      ? normalizeSubcategoryList(entry.bottomSubcategories)
      : [];

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const item of [...legacyTop, ...legacyBottom]) {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function mappingKey(diameterFeet: number, style: DrainRingStyle): string {
  return `${diameterFeet}:${style}`;
}

export function parseRingBuilderConfig(value: unknown): RingBuilderConfig {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_RING_BUILDER_CONFIG;
  }

  const seen = new Set<string>();
  const config: RingBuilderConfig = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const diameterRaw =
      "diameterFeet" in entry ? Number(entry.diameterFeet) : NaN;
    const styleRaw =
      "style" in entry && typeof entry.style === "string"
        ? parseDrainRingStyle(entry.style)
        : "DRAIN";

    if (!Number.isFinite(diameterRaw) || diameterRaw <= 0) {
      continue;
    }

    const key = mappingKey(diameterRaw, styleRaw);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    config.push({
      diameterFeet: diameterRaw,
      style: styleRaw,
      otherSubcategories: parseOtherSubcategoriesFromEntry(entry),
      defaultPricePerFoot: parseDefaultPricePerFoot(
        "defaultPricePerFoot" in entry ? entry.defaultPricePerFoot : 0,
      ),
    });
  }

  return config;
}

export function validateRingBuilderConfig(
  config: RingBuilderConfig,
): string | null {
  const seen = new Set<string>();

  for (const mapping of config) {
    if (!Number.isFinite(mapping.diameterFeet) || mapping.diameterFeet <= 0) {
      return "Each ring mapping needs a valid diameter.";
    }

    const key = mappingKey(mapping.diameterFeet, mapping.style);
    if (seen.has(key)) {
      return `Duplicate mapping for ${mapping.diameterFeet}' ${mapping.style}.`;
    }
    seen.add(key);

    if (
      mapping.style === "SANITARY" &&
      !diameterSupportsRingBuilderSanitary(mapping.diameterFeet)
    ) {
      return `Sanitary style is only valid for ${formatRingBuilderSanitaryDiametersLabel()} diameters.`;
    }

    if (mapping.style === "SOLID") {
      return "Solid style is not supported in the ring builder.";
    }

    if (!ringBuilderDiameterFeetOptions.includes(
      mapping.diameterFeet as (typeof ringBuilderDiameterFeetOptions)[number],
    )) {
      return `${mapping.diameterFeet}' diameter is not supported in the ring builder.`;
    }

    if (
      !Number.isFinite(mapping.defaultPricePerFoot) ||
      mapping.defaultPricePerFoot < 0
    ) {
      return "Default price per foot cannot be negative.";
    }
  }

  return null;
}

export function parseRingBuilderConfigFromFormData(raw: string): RingBuilderConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid ring builder configuration data.");
  }

  return parseRingBuilderConfig(parsed);
}

export function getOtherSubcategoriesFor(
  config: RingBuilderConfig,
  diameterFeet: number,
  style: DrainRingStyle,
): string[] {
  const merged = mergeRingBuilderConfigWithDefaults(config);
  const match = merged.find(
    (entry) =>
      entry.diameterFeet === diameterFeet && entry.style === style,
  );

  return match?.otherSubcategories ?? [];
}

export function getRingDefaultPricePerFoot(
  config: RingBuilderConfig,
  diameterFeet: number,
  ringStyle: DrainRingStyle,
): number {
  const match = config.find(
    (entry) =>
      entry.diameterFeet === diameterFeet && entry.style === ringStyle,
  );

  return match?.defaultPricePerFoot ?? 0;
}

export type RingBuilderInstance = {
  diameterFeet: number;
  style: DrainRingStyle;
  label: string;
};

export function getAllRingBuilderInstances(): RingBuilderInstance[] {
  const instances: RingBuilderInstance[] = [];

  for (const diameter of ringBuilderDiameterFeetOptions) {
    const styleOptions = getRingBuilderStyleOptionsForDiameter(diameter);
    for (const styleOption of styleOptions) {
      instances.push({
        diameterFeet: diameter,
        style: styleOption.value,
        label: `${diameter}' ${styleOption.label}`,
      });
    }
  }

  return instances;
}

export function mergeRingBuilderConfigWithDefaults(
  config: RingBuilderConfig,
): RingBuilderConfig {
  const byKey = new Map<string, RingSlabMapping>();

  for (const mapping of config) {
    byKey.set(mappingKey(mapping.diameterFeet, mapping.style), mapping);
  }

  return getAllRingBuilderInstances().map((instance) => {
    const existing = byKey.get(
      mappingKey(instance.diameterFeet, instance.style),
    );
    return (
      existing ?? {
        diameterFeet: instance.diameterFeet,
        style: instance.style,
        otherSubcategories: [],
        defaultPricePerFoot: 0,
      }
    );
  });
}

export function subcategoryMatchesList(
  subcategory: string,
  allowed: string[],
): boolean {
  const normalized = subcategory.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return allowed.some(
    (entry) => entry.trim().toLowerCase() === normalized,
  );
}

export function getTopLevelRingStyleOptions(diameterFeet: number): {
  value: DrainRingStyle;
  label: string;
}[] {
  const options = drainRingStyleFormOptions.filter(
    (option) => option.value !== "SOLID",
  );

  if (diameterSupportsRingBuilderSanitary(diameterFeet)) {
    return options;
  }

  return options.filter((option) => option.value === "DRAIN");
}

export function getRowRingStyleOptions(topLevelStyle: DrainRingStyle): {
  value: DrainRingStyle;
  label: string;
}[] {
  if (topLevelStyle === "SANITARY") {
    return [
      { value: "SANITARY", label: formatDrainRingStyleLabel("SANITARY") },
    ];
  }

  return [{ value: "DRAIN", label: formatDrainRingStyleLabel("DRAIN") }];
}

export function isTopLevelRingStyle(style: DrainRingStyle): boolean {
  return style === "DRAIN" || style === "SANITARY";
}
