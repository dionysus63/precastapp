import type { DrainRingStyle } from "@/lib/drain-ring-utils";
import {
  diameterSupportsSanitaryDrainRing,
  drainRingStyleFormOptions,
  formatDrainRingStyleLabel,
  formatSanitaryDrainRingDiametersLabel,
  getDrainRingStyleOptionsForDiameter,
  parseDrainRingStyle,
} from "@/lib/drain-ring-utils";
import { drainRingDiameterFeetOptions } from "@/lib/quotes/constants";

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
      !diameterSupportsSanitaryDrainRing(mapping.diameterFeet)
    ) {
      return `Sanitary style is only valid for ${formatSanitaryDrainRingDiametersLabel()} diameters.`;
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
  const match = config.find(
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

  for (const diameter of drainRingDiameterFeetOptions) {
    const styleOptions = getDrainRingStyleOptionsForDiameter(diameter);
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

  if (diameterSupportsSanitaryDrainRing(diameterFeet)) {
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
      { value: "SOLID", label: formatDrainRingStyleLabel("SOLID") },
    ];
  }

  return [
    { value: "DRAIN", label: formatDrainRingStyleLabel("DRAIN") },
    { value: "SOLID", label: formatDrainRingStyleLabel("SOLID") },
  ];
}

export function isTopLevelRingStyle(style: DrainRingStyle): boolean {
  return style === "DRAIN" || style === "SANITARY";
}
