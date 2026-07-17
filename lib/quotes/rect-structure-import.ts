// Parses the rect-structure-import spreadsheet (public/templates/
// rect-structure-import.xlsx) into ready-to-append rect workbook rows.
// One structure per row; repeated "Opening N ..." column groups hold the
// pipes. Groups with Wall + Invert are full drill-sheet openings; groups
// with only Material + Size are quote-only penetrations.

import type { RectOpeningPlacement, RectWall } from "@/lib/rect-structure";
import { createRowId } from "@/lib/quotes/structure-workbook";
import {
  createRectOpeningRow,
  type RectWorkbookOptions,
  type RectWorkbookRow,
} from "@/lib/quotes/rect-structure-workbook";

export type RectImportIssue = {
  /** 1-based spreadsheet row number (as the user sees it in Excel). */
  rowNumber: number;
  structureNumber: string;
  message: string;
};

export type RectImportStructure = {
  rowNumber: number;
  structureNumber: string;
  templateName: string;
  detailLevel: "QUOTE" | "FULL";
  pipeCount: number;
  warnings: string[];
  row: RectWorkbookRow;
};

export type RectImportResult = {
  structures: RectImportStructure[];
  errors: RectImportIssue[];
  /** False when no recognizable header row was found. */
  headerFound: boolean;
};

type Cell = string | number | boolean | null | undefined;

type OpeningColumnGroup = {
  wall?: number;
  material?: number;
  size?: number;
  invert?: number;
  offset?: number;
};

const WALL_ALIASES: Record<string, RectWall> = {
  up: "UP", u: "UP", n: "UP", north: "UP", top: "UP",
  down: "DOWN", d: "DOWN", s: "DOWN", south: "DOWN", bottom: "DOWN",
  left: "LEFT", l: "LEFT", w: "LEFT", west: "LEFT",
  right: "RIGHT", r: "RIGHT", e: "RIGHT", east: "RIGHT",
};

function cellText(cell: Cell): string {
  if (cell == null) {
    return "";
  }
  return String(cell).trim();
}

function parseNumberCell(value: string): number | null {
  if (value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9#]+/g, " ").trim();
}

function findHeaderRow(grid: Cell[][]): number {
  for (let index = 0; index < Math.min(grid.length, 10); index += 1) {
    const headers = (grid[index] ?? []).map((cell) =>
      normalizeHeader(cellText(cell)),
    );
    if (
      headers.some((header) => header.startsWith("structure")) &&
      headers.some((header) => header.startsWith("template"))
    ) {
      return index;
    }
  }
  return -1;
}

export function parseRectStructureImport(
  grid: Cell[][],
  options: RectWorkbookOptions,
): RectImportResult {
  const headerIndex = findHeaderRow(grid);
  if (headerIndex < 0) {
    return { structures: [], errors: [], headerFound: false };
  }

  const headers = (grid[headerIndex] ?? []).map((cell) =>
    normalizeHeader(cellText(cell)),
  );

  const columnOf = (prefix: string): number =>
    headers.findIndex((header) => header.startsWith(prefix));

  const structureCol = columnOf("structure");
  const templateCol = columnOf("template");
  const rimCol = columnOf("rim");
  const lowInvertCol = columnOf("low invert");
  const castingCol = columnOf("casting");

  // "Opening 3 Size (in)" → group 3, field size. Any number of groups.
  const openingGroups = new Map<number, OpeningColumnGroup>();
  headers.forEach((header, index) => {
    const match = /^opening (\d+) (wall|material|size|invert|offset)/.exec(
      header,
    );
    if (!match) {
      return;
    }
    const groupNumber = Number(match[1]);
    const group = openingGroups.get(groupNumber) ?? {};
    group[match[2] as keyof OpeningColumnGroup] = index;
    openingGroups.set(groupNumber, group);
  });
  const orderedGroups = [...openingGroups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, group]) => group);

  const structures: RectImportStructure[] = [];
  const errors: RectImportIssue[] = [];
  const seenNumbers = new Set<string>();

  for (let index = headerIndex + 1; index < grid.length; index += 1) {
    const cells = grid[index] ?? [];
    if (cells.every((cell) => cellText(cell) === "")) {
      continue;
    }
    const rowNumber = index + 1;
    const structureNumber = cellText(cells[structureCol]);
    const templateName = cellText(cells[templateCol]);

    const fail = (message: string) => {
      errors.push({ rowNumber, structureNumber, message });
    };

    if (!structureNumber) {
      fail("Missing Structure # — every structure goes on its own row.");
      continue;
    }
    if (seenNumbers.has(structureNumber.toLowerCase())) {
      fail(`Duplicate structure number "${structureNumber}".`);
      continue;
    }
    if (!templateName) {
      fail("Missing template name.");
      continue;
    }
    const template = options.templates.find(
      (entry) =>
        entry.name.trim().toLowerCase() === templateName.toLowerCase(),
    );
    if (!template) {
      fail(`No rectangular template named "${templateName}".`);
      continue;
    }

    const warnings: string[] = [];

    const rimText = rimCol >= 0 ? cellText(cells[rimCol]) : "";
    if (rimText !== "" && parseNumberCell(rimText) == null) {
      fail(`Rim elevation "${rimText}" is not a number.`);
      continue;
    }
    if (rimText === "") {
      warnings.push("No rim elevation — fill it in the workbook.");
    }

    const lowInvertText =
      lowInvertCol >= 0 ? cellText(cells[lowInvertCol]) : "";
    if (lowInvertText !== "" && parseNumberCell(lowInvertText) == null) {
      fail(`Low invert "${lowInvertText}" is not a number.`);
      continue;
    }

    let castingProductId =
      template.defaultCastingProductId ?? "";
    const castingText = castingCol >= 0 ? cellText(cells[castingCol]) : "";
    if (castingText) {
      const casting = options.castings.find(
        (entry) =>
          entry.name.trim().toLowerCase() === castingText.toLowerCase(),
      );
      if (casting) {
        castingProductId = casting.id;
      } else {
        warnings.push(
          `Casting "${castingText}" not found — using the template default.`,
        );
      }
    }

    // Read the opening groups.
    type ParsedGroup = {
      groupNumber: number;
      wall: RectWall | null;
      wallText: string;
      material: string;
      size: number | null;
      sizeText: string;
      invert: number | null;
      invertText: string;
      offset: number | null;
      offsetText: string;
    };
    const filledGroups: ParsedGroup[] = [];
    let groupError: string | null = null;

    orderedGroups.forEach((group, groupIdx) => {
      const wallText =
        group.wall != null ? cellText(cells[group.wall]) : "";
      const material =
        group.material != null ? cellText(cells[group.material]) : "";
      const sizeText = group.size != null ? cellText(cells[group.size]) : "";
      const invertText =
        group.invert != null ? cellText(cells[group.invert]) : "";
      const offsetText =
        group.offset != null ? cellText(cells[group.offset]) : "";
      if (!wallText && !material && !sizeText && !invertText && !offsetText) {
        return;
      }

      const groupNumber = groupIdx + 1;
      const wall = wallText
        ? (WALL_ALIASES[wallText.toLowerCase()] ?? null)
        : null;
      if (wallText && !wall) {
        groupError ??= `Opening ${groupNumber}: unknown wall "${wallText}" (use Up, Down, Left, Right or N/S/E/W).`;
      }
      const size = parseNumberCell(sizeText);
      if (sizeText && size == null) {
        groupError ??= `Opening ${groupNumber}: pipe size "${sizeText}" is not a number.`;
      }
      const invert = parseNumberCell(invertText);
      if (invertText && invert == null) {
        groupError ??= `Opening ${groupNumber}: invert "${invertText}" is not a number.`;
      }
      const offset = parseNumberCell(offsetText);
      if (offsetText && offset == null) {
        groupError ??= `Opening ${groupNumber}: offset "${offsetText}" is not a number.`;
      }

      filledGroups.push({
        groupNumber,
        wall,
        wallText,
        material,
        size,
        sizeText,
        invert,
        invertText,
        offset,
        offsetText,
      });
    });

    if (groupError) {
      fail(groupError);
      continue;
    }

    const fullGroups = filledGroups.filter(
      (group) => group.wallText !== "" || group.invertText !== "",
    );
    const penetrationGroups = filledGroups.filter(
      (group) => group.wallText === "" && group.invertText === "",
    );

    if (fullGroups.length > 0 && penetrationGroups.length > 0) {
      fail(
        "Mixes full openings (Wall + Invert) with quote-only pipes — use one style for the whole structure.",
      );
      continue;
    }

    let detailLevel: "QUOTE" | "FULL";
    const openings = [];
    const penetrations = [];

    if (fullGroups.length > 0) {
      detailLevel = "FULL";
      let invalid = false;
      for (const group of fullGroups) {
        if (!group.wall || group.invert == null) {
          fail(
            `Opening ${group.groupNumber}: full openings need both Wall and Invert.`,
          );
          invalid = true;
          break;
        }
        if (!group.material || group.size == null) {
          fail(
            `Opening ${group.groupNumber}: missing pipe material or size.`,
          );
          invalid = true;
          break;
        }
        const placement: RectOpeningPlacement =
          group.offset != null ? "FROM_LEFT" : "CENTERED";
        openings.push({
          ...createRectOpeningRow(
            String.fromCharCode(65 + openings.length),
          ),
          wall: group.wall,
          pipeMaterial: group.material,
          pipeSizeInches: group.sizeText,
          invertElevation: group.invertText,
          placement,
          offsetInches: group.offset != null ? group.offsetText : "",
        });
      }
      if (invalid) {
        continue;
      }
      if (lowInvertText !== "") {
        warnings.push(
          "Low Invert is ignored for full drill-sheet structures (it comes from the openings).",
        );
      }
    } else {
      detailLevel = "QUOTE";
      let invalid = false;
      for (const group of penetrationGroups) {
        if (!group.material || group.size == null) {
          fail(
            `Opening ${group.groupNumber}: quote-only pipes need Material and Size.`,
          );
          invalid = true;
          break;
        }
        penetrations.push({
          id: createRowId(),
          pipeMaterial: group.material,
          pipeSizeInches: group.sizeText,
          qty: "1",
        });
      }
      if (invalid) {
        continue;
      }
      if (lowInvertText === "") {
        warnings.push("No Low Invert — fill it in the workbook to price.");
      }
    }

    // Pipe sizes the block-out catalog doesn't know get flagged early.
    for (const group of filledGroups) {
      if (!group.material || group.size == null) {
        continue;
      }
      const known = options.openingSizes.some(
        (entry) =>
          entry.pipeMaterial.trim().toLowerCase() ===
            group.material.toLowerCase() &&
          Math.abs(entry.pipeSizeInches - group.size!) < 1e-6,
      );
      if (!known) {
        warnings.push(
          `No opening size in the catalog for ${group.size}" ${group.material}.`,
        );
      }
    }

    const templateSize = template.presetSizes[0];
    const row: RectWorkbookRow = {
      id: createRowId(),
      structureNumber,
      templateId: template.id,
      insideLengthFeet: templateSize
        ? String(templateSize.insideLengthFeet)
        : "",
      insideWidthFeet: templateSize
        ? String(templateSize.insideWidthFeet)
        : "",
      castingProductId,
      rimElevation: rimText,
      lowInvertElevation: detailLevel === "QUOTE" ? lowInvertText : "",
      hasTopSlab: template.topSlabThicknessInches > 0,
      hasBaseSlab: template.baseSlabThicknessInches > 0,
      baseAttached: template.baseSlabThicknessInches > 0,
      topSlabOpeningLengthInches: "",
      topSlabOpeningWidthInches: "",
      topSlabOpeningSide: "UP",
      penetrations,
      openings:
        openings.length > 0 ? openings : [createRectOpeningRow("A")],
      qty: "1",
      wallHeightFeet: null,
      heaviestPickLbs: null,
      unitPrice: null,
      status: "",
      config: null,
    };

    seenNumbers.add(structureNumber.toLowerCase());
    structures.push({
      rowNumber,
      structureNumber,
      templateName: template.name,
      detailLevel,
      pipeCount:
        detailLevel === "FULL" ? openings.length : penetrations.length,
      warnings,
      row,
    });
  }

  return { structures, errors, headerFound: true };
}

/** Paste support: tab-separated cells straight from Excel. */
export function gridFromTsv(text: string): Cell[][] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.split("\t"));
}
