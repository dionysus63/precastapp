/**
 * Column definitions and client-safe row validation for the Structures bulk
 * import page (/structures/import). Server actions re-validate every row with
 * parseTemplateData / their own parsers — the checks here only power the
 * paste preview, so they must stay DB-free (this module is imported by a
 * client component).
 */

export type StructureImportType =
  | "circular-templates"
  | "rect-templates"
  | "rect-openings"
  | "pipe-openings";

export type StructureImportRow = {
  lineNumber: number;
  cells: string[];
  issues: string[];
  isValid: boolean;
};

export type StructureImportTypeDefinition = {
  type: StructureImportType;
  label: string;
  description: string;
  columns: string[];
  example: string;
};

export const CONNECTION_ALIASES: Record<string, string> = {
  "": "KOR_N_SEAL",
  "kor-n-seal": "KOR_N_SEAL",
  "kor n seal": "KOR_N_SEAL",
  "kor_n_seal": "KOR_N_SEAL",
  korn_seal: "KOR_N_SEAL",
  "cast in": "CAST_IN",
  "cast-in": "CAST_IN",
  cast_in: "CAST_IN",
  castin: "CAST_IN",
  grouted: "GROUTED",
  other: "OTHER",
};

export function parseConnectionCell(text: string): string | null {
  return CONNECTION_ALIASES[text.trim().toLowerCase()] ?? null;
}

export function parseSumpModeCell(text: string): string | null {
  const value = text.trim().toLowerCase();
  if (value === "" || value === "default") return "DEFAULT";
  if (value === "fixed") return "FIXED";
  return null;
}

export function parseStatusCell(text: string): string | null {
  const value = text.trim().toLowerCase();
  if (value === "" || value === "active") return "ACTIVE";
  if (value === "inactive") return "INACTIVE";
  return null;
}

/** Empty means true (boots are the common case for the pipe catalog). */
export function parseBooleanCell(text: string): boolean | null {
  const value = text.trim().toLowerCase();
  if (value === "" || value === "yes" || value === "y" || value === "true" || value === "1") {
    return true;
  }
  if (value === "no" || value === "n" || value === "false" || value === "0") {
    return false;
  }
  return null;
}

/** "4, 5, 6" -> [4, 5, 6]; null when any entry is not a positive number. */
export function parseDiametersCell(text: string): number[] | null {
  const parts = text
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const values: number[] = [];
  for (const part of parts) {
    const num = Number(part);
    if (!Number.isFinite(num) || num <= 0) {
      return null;
    }
    values.push(num);
  }
  return values;
}

/** "4x4, 6x4" -> [{length: 4, width: 4}, ...]; null on any malformed pair. */
export function parseSizesCell(
  text: string,
): Array<{ insideLengthFeet: number; insideWidthFeet: number }> | null {
  const parts = text
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const sizes: Array<{ insideLengthFeet: number; insideWidthFeet: number }> = [];
  for (const part of parts) {
    const match = part.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)$/);
    if (!match) {
      return null;
    }
    sizes.push({
      insideLengthFeet: Number(match[1]),
      insideWidthFeet: Number(match[2]),
    });
  }
  return sizes;
}

function isBlank(cell: string | undefined): boolean {
  return !cell || cell.trim() === "";
}

function numberIssue(
  cell: string | undefined,
  label: string,
  { required = false, allowZero = true }: { required?: boolean; allowZero?: boolean } = {},
): string | null {
  if (isBlank(cell)) {
    return required ? `${label} is required.` : null;
  }
  const num = Number(cell);
  if (!Number.isFinite(num)) {
    return `${label} must be a number.`;
  }
  if (num < 0 || (!allowZero && num === 0)) {
    return `${label} must be ${allowZero ? "zero or more" : "greater than zero"}.`;
  }
  return null;
}

const TEMPLATE_SHARED_COLUMNS = [
  "Name",
  "Agency / Standard",
  "Wall Thk (in)",
  "Base Slab Thk (in)",
  "Top Slab Thk (in)",
  "Min Brick (in)",
  "Connection",
  "Sump Mode",
  "Fixed Sump (in)",
  "Joint Min Top (in)",
  "Joint Min Bottom (in)",
];

export const STRUCTURE_IMPORT_TYPES: StructureImportTypeDefinition[] = [
  {
    type: "circular-templates",
    label: "Circular Templates",
    description:
      "Existing templates are matched by name and updated in place (diameters replaced; the assigned sheet PDF set is kept).",
    columns: [
      ...TEMPLATE_SHARED_COLUMNS,
      "Diameters (ft, comma-separated)",
      "Casting (product code or name)",
      "Status",
      "Notes",
    ],
    example: [
      "SC Storm\tSuffolk County\t5\t8\t8\t2\tKor-N-Seal\tDefault\t\t6\t6\t4, 5, 6\tC-1P\tActive\t",
      "NYSDOT MH\tNYSDOT\t6\t8\t8\t0\tCast In\tFixed\t24\t6\t6\t4, 5\t\tActive\tState work only",
    ].join("\n"),
  },
  {
    type: "rect-templates",
    label: "Rectangular Templates",
    description:
      "Existing templates are matched by name and updated in place (preset sizes replaced; the assigned sheet PDF set is kept). Blank slab thickness means no slab.",
    columns: [
      ...TEMPLATE_SHARED_COLUMNS,
      "Wall $/ft",
      "Min Billed Height (ft)",
      "Top Slab $",
      "Base Slab $",
      "Preset Sizes (LxW ft, comma-separated)",
      "Casting (product code or name)",
      "Status",
      "Notes",
    ],
    example: [
      "4'x2.5' CB\tSuffolk County\t4\t6\t6\t2\tGrouted\tDefault\t\t6\t6\t85\t4\t250\t300\t4x2.5\tCB Frame & Grate\tActive\t",
      "6'x4' Leaching\t\t6\t\t8\t0\tGrouted\tDefault\t\t6\t6\t95\t4\t400\t\t6x4, 8x4\t\tActive\tOpen bottom",
    ].join("\n"),
  },
  {
    type: "rect-openings",
    label: "Rect Structure Openings",
    description:
      "Block-out openings for rectangular structures. Rows are matched by Material + Pipe Size and updated in place.",
    columns: [
      "Material",
      "Pipe Size (in)",
      "Opening W (in)",
      "Opening H (in)",
      "Pipe Wall Thk (in)",
      "Price",
    ],
    example: ["PVC\t12\t16\t16\t0.36\t45", "RCP\t15\t22\t22\t2.25\t55"].join(
      "\n",
    ),
  },
  {
    type: "pipe-openings",
    label: "Round Structure Openings",
    description:
      "Cored/boot openings for circular structures. Rows are matched by Material + Pipe Size + Has Boot and updated in place.",
    columns: [
      "Material",
      "Pipe Size (in)",
      "Hole Dia (in)",
      "Pipe Wall Thk (in)",
      "Has Boot",
      "Boot Model",
      "Boot Price",
    ],
    example: [
      "PVC\t8\t12\t0.24\tYes\tKNS-212\t85",
      "RCP\t12\t20\t2\tNo\t\t",
    ].join("\n"),
  },
];

export function getImportTypeDefinition(
  type: StructureImportType,
): StructureImportTypeDefinition {
  const definition = STRUCTURE_IMPORT_TYPES.find((item) => item.type === type);
  if (!definition) {
    throw new Error(`Unknown import type: ${type}`);
  }
  return definition;
}

function validateTemplateRow(
  cells: string[],
  shape: "CIRCULAR" | "RECTANGULAR",
): string[] {
  const issues: string[] = [];
  const [
    name,
    ,
    wallThk,
    baseThk,
    topThk,
    minBrick,
    connection,
    sumpMode,
    fixedSump,
    jointMinTop,
    jointMinBottom,
  ] = cells;

  if (isBlank(name)) {
    issues.push("Name is required.");
  }
  for (const issue of [
    numberIssue(wallThk, "Wall thickness", { required: true, allowZero: false }),
    // Circular requires both slabs; rect allows blank/0 (open top/bottom).
    numberIssue(baseThk, "Base slab thickness", {
      required: shape === "CIRCULAR",
      allowZero: shape === "RECTANGULAR",
    }),
    numberIssue(topThk, "Top slab thickness", {
      required: shape === "CIRCULAR",
      allowZero: shape === "RECTANGULAR",
    }),
    numberIssue(minBrick, "Min brick", { required: true }),
    numberIssue(jointMinTop, "Joint min top", { required: true }),
    numberIssue(jointMinBottom, "Joint min bottom", { required: true }),
  ]) {
    if (issue) issues.push(issue);
  }

  if (parseConnectionCell(connection ?? "") === null) {
    issues.push(
      `Unknown connection "${connection}". Use Kor-N-Seal, Cast In, Grouted, or Other.`,
    );
  }
  const parsedSump = parseSumpModeCell(sumpMode ?? "");
  if (parsedSump === null) {
    issues.push(`Unknown sump mode "${sumpMode}". Use Default or Fixed.`);
  } else if (parsedSump === "FIXED") {
    const issue = numberIssue(fixedSump, "Fixed sump", {
      required: true,
      allowZero: false,
    });
    if (issue) issues.push(issue);
  }

  if (shape === "CIRCULAR") {
    const diametersCell = cells[11] ?? "";
    const diameters = parseDiametersCell(diametersCell);
    if (diameters === null) {
      issues.push(`Diameters "${diametersCell}" must be numbers like "4, 5, 6".`);
    } else if (diameters.length === 0) {
      issues.push("At least one diameter is required.");
    } else if (new Set(diameters).size !== diameters.length) {
      issues.push("Duplicate diameters in row.");
    }
    if (parseStatusCell(cells[13] ?? "") === null) {
      issues.push(`Unknown status "${cells[13]}". Use Active or Inactive.`);
    }
  } else {
    for (const [index, label] of [
      [11, "Wall $/ft"],
      [12, "Min billed height"],
      [13, "Top slab $"],
      [14, "Base slab $"],
    ] as const) {
      const issue = numberIssue(cells[index], label);
      if (issue) issues.push(issue);
    }
    const sizesCell = cells[15] ?? "";
    if (!isBlank(sizesCell) && parseSizesCell(sizesCell) === null) {
      issues.push(`Preset sizes "${sizesCell}" must look like "4x4, 6x4".`);
    }
    if (parseStatusCell(cells[17] ?? "") === null) {
      issues.push(`Unknown status "${cells[17]}". Use Active or Inactive.`);
    }
  }

  return issues;
}

function validateRectOpeningRow(cells: string[]): string[] {
  const issues: string[] = [];
  if (isBlank(cells[0])) {
    issues.push("Material is required.");
  }
  for (const issue of [
    numberIssue(cells[1], "Pipe size", { required: true, allowZero: false }),
    numberIssue(cells[2], "Opening width", { required: true, allowZero: false }),
    numberIssue(cells[3], "Opening height", { required: true, allowZero: false }),
    numberIssue(cells[4], "Pipe wall thickness"),
    numberIssue(cells[5], "Price"),
  ]) {
    if (issue) issues.push(issue);
  }
  return issues;
}

function validatePipeOpeningRow(cells: string[]): string[] {
  const issues: string[] = [];
  if (isBlank(cells[0])) {
    issues.push("Material is required.");
  }
  for (const issue of [
    numberIssue(cells[1], "Pipe size", { required: true, allowZero: false }),
    numberIssue(cells[2], "Hole diameter", { required: true, allowZero: false }),
    numberIssue(cells[3], "Pipe wall thickness"),
    numberIssue(cells[6], "Boot price"),
  ]) {
    if (issue) issues.push(issue);
  }
  if (parseBooleanCell(cells[4] ?? "") === null) {
    issues.push(`Has boot "${cells[4]}" must be Yes or No.`);
  }
  return issues;
}

/**
 * Maps a validated template row's cells to the plain data object that
 * parseTemplateData (lib/structure-template-payload.ts) validates. Blank
 * numeric cells become the same defaults the template form uses.
 */
export function templateDataFromCells(
  shape: "CIRCULAR" | "RECTANGULAR",
  cells: string[],
  castingProductId: string | null,
): Record<string, unknown> {
  const shared = {
    name: cells[0] ?? "",
    agencyStandard: cells[1] ?? "",
    shape,
    wallThicknessInches: cells[2] ?? "",
    baseSlabThicknessInches:
      (cells[3] ?? "").trim() || (shape === "RECTANGULAR" ? 0 : ""),
    topSlabThicknessInches:
      (cells[4] ?? "").trim() || (shape === "RECTANGULAR" ? 0 : ""),
    minimumBrickInches: (cells[5] ?? "").trim() || 0,
    connectionType: parseConnectionCell(cells[6] ?? "") ?? "KOR_N_SEAL",
    sumpMode: parseSumpModeCell(cells[7] ?? "") ?? "DEFAULT",
    sumpFixedInches: (cells[8] ?? "").trim(),
    openingToJointMinTopInches: (cells[9] ?? "").trim() || 0,
    openingToJointMinBottomInches: (cells[10] ?? "").trim() || 0,
    castingProductId,
  };

  if (shape === "CIRCULAR") {
    return {
      ...shared,
      diameters: (parseDiametersCell(cells[11] ?? "") ?? []).map((value) => ({
        insideDiameterFeet: value,
      })),
      status: parseStatusCell(cells[13] ?? "") ?? "ACTIVE",
      notes: cells[14] ?? "",
    };
  }
  return {
    ...shared,
    rectWallPricePerFoot: (cells[11] ?? "").trim(),
    rectMinPricingHeightFeet: (cells[12] ?? "").trim(),
    rectTopSlabPrice: (cells[13] ?? "").trim(),
    rectBaseSlabPrice: (cells[14] ?? "").trim(),
    rectSizes: parseSizesCell(cells[15] ?? "") ?? [],
    status: parseStatusCell(cells[17] ?? "") ?? "ACTIVE",
    notes: cells[18] ?? "",
  };
}

/** Natural key per type, for in-batch duplicate detection. */
function rowKey(type: StructureImportType, cells: string[]): string {
  switch (type) {
    case "circular-templates":
    case "rect-templates":
      return (cells[0] ?? "").trim().toLowerCase();
    case "rect-openings":
      return `${(cells[0] ?? "").trim().toLowerCase()}|${Number(cells[1])}`;
    case "pipe-openings":
      return `${(cells[0] ?? "").trim().toLowerCase()}|${Number(cells[1])}|${parseBooleanCell(cells[4] ?? "")}`;
  }
}

export function parseStructureImportText(
  type: StructureImportType,
  text: string,
): StructureImportRow[] {
  const definition = getImportTypeDefinition(type);
  const lines = text.split(/\r?\n/);

  const rows: StructureImportRow[] = [];
  lines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }
    // Tab-separated is what Excel produces; fall back to commas only for
    // types whose values never contain commas themselves.
    const delimiter =
      line.includes("\t") ||
      type === "circular-templates" ||
      type === "rect-templates"
        ? "\t"
        : ",";
    const cells = line.split(delimiter).map((cell) => cell.trim());
    if (cells.length > definition.columns.length) {
      cells.length = definition.columns.length;
    }

    let issues: string[];
    switch (type) {
      case "circular-templates":
        issues = validateTemplateRow(cells, "CIRCULAR");
        break;
      case "rect-templates":
        issues = validateTemplateRow(cells, "RECTANGULAR");
        break;
      case "rect-openings":
        issues = validateRectOpeningRow(cells);
        break;
      case "pipe-openings":
        issues = validatePipeOpeningRow(cells);
        break;
    }

    rows.push({
      lineNumber: index + 1,
      cells,
      issues,
      isValid: issues.length === 0,
    });
  });

  // In-batch duplicates on the natural key would make the upsert order
  // dependent — reject them up front.
  const seen = new Map<string, number>();
  for (const row of rows) {
    if (!row.isValid) {
      continue;
    }
    const key = rowKey(type, row.cells);
    const firstLine = seen.get(key);
    if (firstLine !== undefined) {
      row.issues.push(`Duplicate of line ${firstLine} in this paste.`);
      row.isValid = false;
    } else {
      seen.set(key, row.lineNumber);
    }
  }

  return rows;
}
