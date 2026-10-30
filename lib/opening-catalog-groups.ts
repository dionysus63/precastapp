/**
 * Groups the flat opening catalogs (one row per material + size, plus boot /
 * no boot for round structures) into one card per material for the catalog
 * pages, and flattens the cards back into rows for the save actions. The
 * database shape is unchanged; this is only how the pages present it.
 */

/** Flat round-opening row as the catalog page loads and saves it. */
export type PipeOpeningCatalogRow = {
  /** Catalog row id; absent for rows the user just added. */
  id?: string;
  /** Combined material/type description, e.g. "PVC SDR35". */
  pipeMaterial: string;
  pipeSizeInches: string;
  hasBoot: boolean;
  holeDiameterInches: string;
  pipeWallThicknessInches: string;
  bootModel: string;
  pricePerBoot: string;
};

/** One size line in a round material card: boot and no-boot side by side. */
export type PipeOpeningSizeLine = {
  key: string;
  pipeSizeInches: string;
  /** Shared by the boot and no-boot rows (same pipe). */
  pipeWallThicknessInches: string;
  bootRowId?: string;
  bootHoleInches: string;
  bootModel: string;
  pricePerBoot: string;
  noBootRowId?: string;
  noBootHoleInches: string;
  /** Legacy no-boot rows could carry a model/price; kept so a save doesn't drop them. */
  noBootModel: string;
  noBootPrice: string;
};

export type PipeOpeningMaterialGroup = {
  key: string;
  pipeMaterial: string;
  /** Show and save the boot columns. */
  boot: boolean;
  /** Show and save the no-boot (grouted) column. */
  noBoot: boolean;
  sizes: PipeOpeningSizeLine[];
};

/** Flat rect-opening row as the catalog page loads and saves it. */
export type RectOpeningCatalogRow = {
  id?: string;
  pipeMaterial: string;
  pipeSizeInches: string;
  openingWidthInches: string;
  openingHeightInches: string;
  pipeWallThicknessInches: string;
  pricePerOpening: string;
};

export type RectOpeningSizeLine = Omit<
  RectOpeningCatalogRow,
  "pipeMaterial"
> & {
  key: string;
};

export type RectOpeningMaterialGroup = {
  key: string;
  pipeMaterial: string;
  sizes: RectOpeningSizeLine[];
};

export function normalizeMaterialKey(material: string): string {
  return material.trim().replace(/\s+/g, " ").toLowerCase();
}

function sizeNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value.trim() !== "" ? parsed : Infinity;
}

/** Smallest first; blank / invalid sizes (new rows) stay at the bottom in order. */
export function compareSizeLines(
  left: { pipeSizeInches: string },
  right: { pipeSizeInches: string },
): number {
  const a = sizeNumber(left.pipeSizeInches);
  const b = sizeNumber(right.pipeSizeInches);
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Groups by material in first-seen order; sizes sorted smallest first. */
function groupByMaterial<T extends { pipeMaterial: string }>(
  rows: T[],
): { pipeMaterial: string; rows: T[] }[] {
  const groups = new Map<string, { pipeMaterial: string; rows: T[] }>();
  for (const row of rows) {
    const key = normalizeMaterialKey(row.pipeMaterial);
    const group = groups.get(key);
    if (group) {
      group.rows.push(row);
    } else {
      groups.set(key, { pipeMaterial: row.pipeMaterial.trim(), rows: [row] });
    }
  }
  return [...groups.values()];
}

export function groupPipeOpeningRows(
  rows: PipeOpeningCatalogRow[],
  makeKey: () => string,
): PipeOpeningMaterialGroup[] {
  return groupByMaterial(rows).map(({ pipeMaterial, rows: groupRows }) => {
    const bySize = new Map<string, PipeOpeningSizeLine>();
    for (const row of groupRows) {
      const sizeKey = String(sizeNumber(row.pipeSizeInches));
      let line = bySize.get(sizeKey);
      if (!line) {
        line = {
          ...emptyPipeSizeLine(makeKey()),
          pipeSizeInches: row.pipeSizeInches,
        };
        bySize.set(sizeKey, line);
      }
      if (row.hasBoot) {
        line.bootRowId = row.id;
        line.bootHoleInches = row.holeDiameterInches;
        line.bootModel = row.bootModel;
        line.pricePerBoot = row.pricePerBoot;
        // The boot row's wall wins if the two legacy rows disagree.
        if (row.pipeWallThicknessInches) {
          line.pipeWallThicknessInches = row.pipeWallThicknessInches;
        }
      } else {
        line.noBootRowId = row.id;
        line.noBootHoleInches = row.holeDiameterInches;
        line.noBootModel = row.bootModel;
        line.noBootPrice = row.pricePerBoot;
        if (!line.pipeWallThicknessInches) {
          line.pipeWallThicknessInches = row.pipeWallThicknessInches;
        }
      }
    }
    return {
      key: makeKey(),
      pipeMaterial,
      boot: groupRows.some((row) => row.hasBoot),
      noBoot: groupRows.some((row) => !row.hasBoot),
      sizes: [...bySize.values()].sort(compareSizeLines),
    };
  });
}

export function emptyPipeSizeLine(key: string): PipeOpeningSizeLine {
  return {
    key,
    pipeSizeInches: "",
    pipeWallThicknessInches: "",
    bootHoleInches: "",
    bootModel: "",
    pricePerBoot: "",
    noBootHoleInches: "",
    noBootModel: "",
    noBootPrice: "",
  };
}

export function emptyPipeMaterialGroup(
  makeKey: () => string,
): PipeOpeningMaterialGroup {
  return {
    key: makeKey(),
    pipeMaterial: "",
    boot: true,
    noBoot: true,
    sizes: [emptyPipeSizeLine(makeKey())],
  };
}

function isBlankPipeLine(line: PipeOpeningSizeLine): boolean {
  return [
    line.pipeSizeInches,
    line.pipeWallThicknessInches,
    line.bootHoleInches,
    line.bootModel,
    line.pricePerBoot,
    line.noBootHoleInches,
  ].every((value) => value.trim() === "");
}

/**
 * Problems that would otherwise make the save silently skip or merge rows.
 * Returns one message per problem (empty = OK to save).
 */
export function validatePipeOpeningGroups(
  groups: PipeOpeningMaterialGroup[],
): string[] {
  const errors: string[] = [];
  const materials = new Set<string>();
  for (const group of groups) {
    const lines = group.sizes.filter((line) => !isBlankPipeLine(line));
    if (lines.length === 0) continue;
    const name = group.pipeMaterial.trim();
    if (!name) {
      errors.push("A material with sizes has no name.");
      continue;
    }
    const materialKey = normalizeMaterialKey(name);
    if (materials.has(materialKey)) {
      errors.push(
        `"${name}" is listed twice. Combine the sizes into one material.`,
      );
    }
    materials.add(materialKey);
    if (!group.boot && !group.noBoot) {
      errors.push(`${name}: turn on Boot or No Boot, or remove the material.`);
      continue;
    }
    const sizes = new Set<number>();
    for (const line of lines) {
      const size = sizeNumber(line.pipeSizeInches);
      if (!Number.isFinite(size) || size <= 0) {
        errors.push(`${name}: every line needs a pipe size.`);
        continue;
      }
      if (sizes.has(size)) {
        errors.push(`${name}: ${size}" is listed twice.`);
      }
      sizes.add(size);
      const hasBootHole = group.boot && line.bootHoleInches.trim() !== "";
      const hasNoBootHole = group.noBoot && line.noBootHoleInches.trim() !== "";
      if (!hasBootHole && !hasNoBootHole) {
        errors.push(`${name} ${size}": enter a hole size.`);
      }
    }
  }
  return errors;
}

/** Flattens cards back to catalog rows (sorted by material order, then size). */
export function flattenPipeOpeningGroups(
  groups: PipeOpeningMaterialGroup[],
): PipeOpeningCatalogRow[] {
  const rows: PipeOpeningCatalogRow[] = [];
  for (const group of groups) {
    const pipeMaterial = group.pipeMaterial.trim();
    if (!pipeMaterial) continue;
    for (const line of [...group.sizes].sort(compareSizeLines)) {
      if (line.pipeSizeInches.trim() === "") continue;
      if (group.boot && line.bootHoleInches.trim() !== "") {
        rows.push({
          id: line.bootRowId,
          pipeMaterial,
          pipeSizeInches: line.pipeSizeInches,
          hasBoot: true,
          holeDiameterInches: line.bootHoleInches,
          pipeWallThicknessInches: line.pipeWallThicknessInches,
          bootModel: line.bootModel,
          pricePerBoot: line.pricePerBoot,
        });
      }
      if (group.noBoot && line.noBootHoleInches.trim() !== "") {
        rows.push({
          id: line.noBootRowId,
          pipeMaterial,
          pipeSizeInches: line.pipeSizeInches,
          hasBoot: false,
          holeDiameterInches: line.noBootHoleInches,
          pipeWallThicknessInches: line.pipeWallThicknessInches,
          bootModel: line.noBootModel,
          pricePerBoot: line.noBootPrice,
        });
      }
    }
  }
  return rows;
}

export function groupRectOpeningRows(
  rows: RectOpeningCatalogRow[],
  makeKey: () => string,
): RectOpeningMaterialGroup[] {
  return groupByMaterial(rows).map(({ pipeMaterial, rows: groupRows }) => ({
    key: makeKey(),
    pipeMaterial,
    sizes: groupRows
      .map(({ pipeMaterial: _material, ...line }) => ({
        ...line,
        key: makeKey(),
      }))
      .sort(compareSizeLines),
  }));
}

export function emptyRectSizeLine(key: string): RectOpeningSizeLine {
  return {
    key,
    pipeSizeInches: "",
    openingWidthInches: "",
    openingHeightInches: "",
    pipeWallThicknessInches: "",
    pricePerOpening: "",
  };
}

export function emptyRectMaterialGroup(
  makeKey: () => string,
): RectOpeningMaterialGroup {
  return {
    key: makeKey(),
    pipeMaterial: "",
    sizes: [emptyRectSizeLine(makeKey())],
  };
}

function isBlankRectLine(line: RectOpeningSizeLine): boolean {
  return [
    line.pipeSizeInches,
    line.openingWidthInches,
    line.openingHeightInches,
    line.pipeWallThicknessInches,
    line.pricePerOpening,
  ].every((value) => value.trim() === "");
}

export function validateRectOpeningGroups(
  groups: RectOpeningMaterialGroup[],
): string[] {
  const errors: string[] = [];
  const materials = new Set<string>();
  for (const group of groups) {
    const lines = group.sizes.filter((line) => !isBlankRectLine(line));
    if (lines.length === 0) continue;
    const name = group.pipeMaterial.trim();
    if (!name) {
      errors.push("A material with sizes has no name.");
      continue;
    }
    const materialKey = normalizeMaterialKey(name);
    if (materials.has(materialKey)) {
      errors.push(
        `"${name}" is listed twice. Combine the sizes into one material.`,
      );
    }
    materials.add(materialKey);
    const sizes = new Set<number>();
    for (const line of lines) {
      const size = sizeNumber(line.pipeSizeInches);
      if (!Number.isFinite(size) || size <= 0) {
        errors.push(`${name}: every line needs a pipe size.`);
        continue;
      }
      if (sizes.has(size)) {
        errors.push(`${name}: ${size}" is listed twice.`);
      }
      sizes.add(size);
      if (
        !(Number(line.openingWidthInches) > 0) ||
        !(Number(line.openingHeightInches) > 0)
      ) {
        errors.push(`${name} ${size}": enter the opening width and height.`);
      }
    }
  }
  return errors;
}

export function flattenRectOpeningGroups(
  groups: RectOpeningMaterialGroup[],
): RectOpeningCatalogRow[] {
  const rows: RectOpeningCatalogRow[] = [];
  for (const group of groups) {
    const pipeMaterial = group.pipeMaterial.trim();
    if (!pipeMaterial) continue;
    for (const line of [...group.sizes].sort(compareSizeLines)) {
      if (line.pipeSizeInches.trim() === "") continue;
      const { key: _key, ...row } = line;
      rows.push({ ...row, pipeMaterial });
    }
  }
  return rows;
}

/** Sizes in a card that appear more than once (for flagging the inputs). */
export function duplicateSizeKeys(
  sizes: { key: string; pipeSizeInches: string }[],
): Set<string> {
  const seen = new Map<number, string>();
  const duplicates = new Set<string>();
  for (const line of sizes) {
    const size = sizeNumber(line.pipeSizeInches);
    if (!Number.isFinite(size)) continue;
    const first = seen.get(size);
    if (first) {
      duplicates.add(first);
      duplicates.add(line.key);
    } else {
      seen.set(size, line.key);
    }
  }
  return duplicates;
}
