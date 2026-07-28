// Bulk import of CUSTOM job structures (e.g. a sound wall's piece types):
// plain rows with a number, description, and quantity — no template, no
// drill sheet. One row per unique piece TYPE; the quantity carries the
// piece count, so a 1,500-piece wall imports as ~50 rows.
//
// Mirrors the header-matched, order-independent parsing of the circular /
// rectangular structure imports (lib/quotes/*-structure-import.ts).

export type CustomImportIssue = {
  /** 1-based spreadsheet row number (as the user sees it in Excel). */
  rowNumber: number;
  structureNumber: string;
  message: string;
};

export type CustomImportEntry = {
  structureNumber: string;
  description: string;
  quantity: number;
  unit: string;
  /** Per-piece weight in pounds (null when not provided). */
  weightEachLbs: number | null;
  /** Per-piece unit price in dollars — quote imports only (null when not provided). */
  unitPriceEach: number | null;
  /** Per-piece concrete yards — quote imports only (null when not provided). */
  yardsEach: number | null;
  needsSubmittal: boolean;
  notes: string | null;
};

export type CustomImportRow = {
  rowNumber: number;
  entry: CustomImportEntry;
  warnings: string[];
};

export type CustomImportResult = {
  rows: CustomImportRow[];
  errors: CustomImportIssue[];
  /** False when no recognizable header row was found. */
  headerFound: boolean;
};

type Cell = string | number | boolean | null | undefined;

function cellText(cell: Cell): string {
  if (cell == null) {
    return "";
  }
  return String(cell).trim();
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9#]+/g, " ").trim();
}

function parseNumberCell(value: string): number | null {
  if (value === "") {
    return null;
  }
  const numeric = Number(value.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseYesNo(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "" ) {
    return null;
  }
  if (["yes", "y", "true", "1"].includes(normalized)) {
    return true;
  }
  if (["no", "n", "false", "0"].includes(normalized)) {
    return false;
  }
  return null;
}

type ColumnMap = {
  structure?: number;
  description?: number;
  qty?: number;
  unit?: number;
  weight?: number;
  price?: number;
  yards?: number;
  submittal?: number;
  notes?: number;
};

function findHeader(grid: Cell[][]): { rowIndex: number; columns: ColumnMap } | null {
  for (let index = 0; index < Math.min(grid.length, 10); index += 1) {
    const headers = (grid[index] ?? []).map((cell) =>
      normalizeHeader(cellText(cell)),
    );
    const columns: ColumnMap = {};
    headers.forEach((header, column) => {
      if (!header) {
        return;
      }
      if (columns.structure == null && (header.startsWith("structure") || header.startsWith("piece") || header === "#")) {
        columns.structure = column;
      } else if (columns.description == null && header.startsWith("desc")) {
        columns.description = column;
      } else if (columns.qty == null && (header.startsWith("qty") || header.startsWith("quantity") || header.startsWith("count"))) {
        columns.qty = column;
      } else if (columns.price == null && header.includes("price")) {
        // Checked before "unit" so "Unit Price" lands on price, not unit.
        columns.price = column;
      } else if (columns.unit == null && header.startsWith("unit")) {
        columns.unit = column;
      } else if (columns.weight == null && header.startsWith("weight")) {
        columns.weight = column;
      } else if (columns.yards == null && (header.startsWith("yard") || header === "cy")) {
        columns.yards = column;
      } else if (columns.submittal == null && header.includes("submittal")) {
        columns.submittal = column;
      } else if (columns.notes == null && header.startsWith("note")) {
        columns.notes = column;
      }
    });
    if (columns.structure != null && columns.description != null) {
      return { rowIndex: index, columns };
    }
  }
  return null;
}

export function parseCustomStructureImport(grid: Cell[][]): CustomImportResult {
  const header = findHeader(grid);
  if (!header) {
    return { rows: [], errors: [], headerFound: false };
  }

  const rows: CustomImportRow[] = [];
  const errors: CustomImportIssue[] = [];
  const seenNumbers = new Set<string>();

  for (let index = header.rowIndex + 1; index < grid.length; index += 1) {
    const cells = grid[index] ?? [];
    const rowNumber = index + 1;
    const at = (column: number | undefined) =>
      column == null ? "" : cellText(cells[column]);

    const structureNumber = at(header.columns.structure);
    const description = at(header.columns.description);
    if (!structureNumber && !description) {
      continue; // blank row
    }

    const fail = (message: string) => {
      errors.push({ rowNumber, structureNumber, message });
    };

    if (!structureNumber) {
      fail("Structure # is required.");
      continue;
    }
    if (!description) {
      fail("Description is required.");
      continue;
    }
    if (seenNumbers.has(structureNumber.toLowerCase())) {
      fail("Duplicate structure # in this import.");
      continue;
    }

    const warnings: string[] = [];

    const qtyText = at(header.columns.qty);
    let quantity = 1;
    if (qtyText !== "") {
      const parsed = parseNumberCell(qtyText);
      if (parsed == null || parsed <= 0 || !Number.isInteger(parsed)) {
        fail(`Qty "${qtyText}" must be a positive whole number.`);
        continue;
      }
      quantity = parsed;
    }

    const weightText = at(header.columns.weight);
    let weightEachLbs: number | null = null;
    if (weightText !== "") {
      const parsed = parseNumberCell(weightText);
      if (parsed == null || parsed <= 0) {
        fail(`Weight "${weightText}" must be a positive number of pounds.`);
        continue;
      }
      weightEachLbs = parsed;
    }

    const priceText = at(header.columns.price).replace(/\$/g, "");
    let unitPriceEach: number | null = null;
    if (priceText !== "") {
      const parsed = parseNumberCell(priceText);
      if (parsed == null || parsed < 0) {
        fail(`Unit Price "${priceText}" must be a number.`);
        continue;
      }
      unitPriceEach = parsed;
    }

    const yardsText = at(header.columns.yards);
    let yardsEach: number | null = null;
    if (yardsText !== "") {
      const parsed = parseNumberCell(yardsText);
      if (parsed == null || parsed < 0) {
        fail(`Yards "${yardsText}" must be a number.`);
        continue;
      }
      yardsEach = parsed;
    }

    const submittalText = at(header.columns.submittal);
    let needsSubmittal = true;
    if (submittalText !== "") {
      const parsed = parseYesNo(submittalText);
      if (parsed == null) {
        fail(`Submittal Needed "${submittalText}" must be Yes or No.`);
        continue;
      }
      needsSubmittal = parsed;
    }

    seenNumbers.add(structureNumber.toLowerCase());
    rows.push({
      rowNumber,
      warnings,
      entry: {
        structureNumber,
        description,
        quantity,
        unit: at(header.columns.unit) || "EA",
        weightEachLbs,
        unitPriceEach,
        yardsEach,
        needsSubmittal,
        notes: at(header.columns.notes) || null,
      },
    });
  }

  return { rows, errors, headerFound: true };
}

/** Paste support: tab-separated cells straight from Excel. */
export function customGridFromTsv(text: string): Cell[][] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.split("\t"));
}
