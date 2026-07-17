// Parses the circular-structure-import spreadsheet (public/templates/
// circular-structure-import.xlsx) into ready-to-append circular workbook
// rows. One structure per row; repeated "Opening N ..." column groups hold
// the pipes. Groups with an Invert are full drill-sheet openings; groups
// with only Material + Size are quote-only penetrations.

import {
  createDefaultOpening,
  createRowId,
  nextOpeningLabel,
  type StructureWorkbookOptions,
  type StructureWorkbookRow,
} from "@/lib/quotes/structure-workbook";

export type CircularImportIssue = {
  /** 1-based spreadsheet row number (as the user sees it in Excel). */
  rowNumber: number;
  structureNumber: string;
  message: string;
};

export type CircularImportStructure = {
  rowNumber: number;
  structureNumber: string;
  templateName: string;
  diameterFeet: number;
  detailLevel: "QUOTE" | "FULL";
  pipeCount: number;
  warnings: string[];
  row: StructureWorkbookRow;
};

export type CircularImportResult = {
  structures: CircularImportStructure[];
  errors: CircularImportIssue[];
  /** False when no recognizable header row was found. */
  headerFound: boolean;
};

type Cell = string | number | boolean | null | undefined;

type OpeningColumnGroup = {
  material?: number;
  size?: number;
  invert?: number;
  angle?: number;
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

export function parseCircularStructureImport(
  grid: Cell[][],
  options: StructureWorkbookOptions,
): CircularImportResult {
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
  const diameterCol = columnOf("diameter");
  const rimCol = columnOf("rim");
  const lowInvertCol = columnOf("low invert");
  const castingCol = columnOf("casting");

  const openingGroups = new Map<number, OpeningColumnGroup>();
  headers.forEach((header, index) => {
    const match = /^opening (\d+) (material|size|invert|angle)/.exec(header);
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

  const structures: CircularImportStructure[] = [];
  const errors: CircularImportIssue[] = [];
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
      fail(`No circular template named "${templateName}".`);
      continue;
    }

    const diameterText = diameterCol >= 0 ? cellText(cells[diameterCol]) : "";
    const diameterFeet = parseNumberCell(diameterText);
    if (diameterFeet == null) {
      fail(
        diameterText === ""
          ? "Missing diameter."
          : `Diameter "${diameterText}" is not a number.`,
      );
      continue;
    }
    const offered = template.diameters.some(
      (entry) => Math.abs(entry.insideDiameterFeet - diameterFeet) < 1e-6,
    );
    if (!offered) {
      const available = template.diameters
        .map((entry) => `${entry.insideDiameterFeet}'`)
        .join(", ");
      fail(
        `${template.name} does not offer a ${diameterFeet}' diameter (offers ${available || "none"}).`,
      );
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

    let castingProductId = template.defaultCastingProductId ?? "";
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

    type ParsedGroup = {
      groupNumber: number;
      material: string;
      size: number | null;
      sizeText: string;
      invert: number | null;
      invertText: string;
      angle: number | null;
      angleText: string;
    };
    const filledGroups: ParsedGroup[] = [];
    let groupError: string | null = null;

    orderedGroups.forEach((group, groupIdx) => {
      const material =
        group.material != null ? cellText(cells[group.material]) : "";
      const sizeText = group.size != null ? cellText(cells[group.size]) : "";
      const invertText =
        group.invert != null ? cellText(cells[group.invert]) : "";
      const angleText =
        group.angle != null ? cellText(cells[group.angle]) : "";
      if (!material && !sizeText && !invertText && !angleText) {
        return;
      }

      const groupNumber = groupIdx + 1;
      const size = parseNumberCell(sizeText);
      if (sizeText && size == null) {
        groupError ??= `Opening ${groupNumber}: pipe size "${sizeText}" is not a number.`;
      }
      const invert = parseNumberCell(invertText);
      if (invertText && invert == null) {
        groupError ??= `Opening ${groupNumber}: invert "${invertText}" is not a number.`;
      }
      const angle = parseNumberCell(angleText);
      if (angleText && angle == null) {
        groupError ??= `Opening ${groupNumber}: angle "${angleText}" is not a number.`;
      }

      filledGroups.push({
        groupNumber,
        material,
        size,
        sizeText,
        invert,
        invertText,
        angle,
        angleText,
      });
    });

    if (groupError) {
      fail(groupError);
      continue;
    }

    const fullGroups = filledGroups.filter(
      (group) => group.invertText !== "" || group.angleText !== "",
    );
    const penetrationGroups = filledGroups.filter(
      (group) => group.invertText === "" && group.angleText === "",
    );

    if (fullGroups.length > 0 && penetrationGroups.length > 0) {
      fail(
        "Mixes full openings (with inverts) and quote-only pipes — use one style for the whole structure.",
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
        if (group.invert == null) {
          fail(`Opening ${group.groupNumber}: full openings need an Invert.`);
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
        openings.push({
          ...createDefaultOpening(nextOpeningLabel(openings.length)),
          pipeMaterial: group.material,
          pipeSizeInches: group.sizeText,
          invertElevation: group.invertText,
          angleDegrees: group.angleText || "0",
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

    const firstPipe = filledGroups[0] ?? null;
    const row: StructureWorkbookRow = {
      id: createRowId(),
      structureNumber,
      templateId: template.id,
      diameterFeet: String(diameterFeet),
      castingProductId,
      rimElevation: rimText,
      lowInvertElevation: detailLevel === "QUOTE" ? lowInvertText : "",
      pipeMaterial: firstPipe?.material ?? "",
      pipeSizeInches: firstPipe?.sizeText ?? "",
      pipeType: "",
      bootCount: String(Math.max(1, penetrations.length)),
      qty: "1",
      penetrations,
      openings:
        openings.length > 0 ? openings : [createDefaultOpening("A")],
      wallHeightFeet: null,
      unitPrice: null,
      status: "",
      structureConfig: null,
    };

    seenNumbers.add(structureNumber.toLowerCase());
    structures.push({
      rowNumber,
      structureNumber,
      templateName: template.name,
      diameterFeet,
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
export function circularGridFromTsv(text: string): Cell[][] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.split("\t"));
}
