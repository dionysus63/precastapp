// Regenerates public/templates/custom-structure-import.xlsx — the blank
// spreadsheet for bulk-adding CUSTOM structures (plain tracked pieces) to a
// job. Run: node scripts/generate-custom-import-template.mjs
import { mkdirSync } from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

const HEADERS = [
  "Structure #",
  "Description",
  "Qty",
  "Unit",
  "Weight Each (lbs)",
  "Submittal Needed",
  "Notes",
];

const EXAMPLE_ROWS = [
  ["SW-P1", 'Sound Wall Panel Type 1 — 12\' x 8\'', 120, "EA", 9800, "Yes", ""],
  ["SW-P2", 'Sound Wall Panel Type 2 — 12\' x 6\'', 85, "EA", 7400, "Yes", ""],
  ["SW-C1", "Sound Wall Column — 24\" Standard", 60, "EA", 5200, "Yes", "Galvanized inserts"],
  ["SW-CAP", "Column Cap", 60, "EA", 350, "No", ""],
];

const INSTRUCTIONS = [
  ["Custom Structure Import — How to fill this in"],
  [""],
  ["One row per unique PIECE TYPE. The Qty column carries the piece count,"],
  ["so a 1,500-piece wall imports as one row per type (~50 rows)."],
  [""],
  ["Structure # — unique per job; used everywhere the piece is tracked."],
  ["Description — what prints on tickets and shows on the production board."],
  ["Qty — how many of this piece the job needs (default 1)."],
  ["Unit — default EA."],
  ["Weight Each (lbs) — per-piece weight, optional."],
  ["Submittal Needed — Yes (default) requires a submittal upload before the"],
  ["piece can be marked submitted/approved; No skips that gate."],
  ["Notes — optional, shows on the structure."],
  [""],
  ["Import from the job page: Structures & Production -> Add Custom"],
  ["Structures. Only the Structure # and Description headings are required;"],
  ["extra columns are matched by name and may be left out or reordered."],
];

const workbook = xlsx.utils.book_new();

const structuresSheet = xlsx.utils.aoa_to_sheet([HEADERS, ...EXAMPLE_ROWS]);
structuresSheet["!cols"] = [
  { wch: 12 },
  { wch: 40 },
  { wch: 6 },
  { wch: 6 },
  { wch: 16 },
  { wch: 16 },
  { wch: 28 },
];
xlsx.utils.book_append_sheet(workbook, structuresSheet, "Structures");

const instructionsSheet = xlsx.utils.aoa_to_sheet(INSTRUCTIONS);
instructionsSheet["!cols"] = [{ wch: 76 }];
xlsx.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

const outPath = path.join(
  process.cwd(),
  "public",
  "templates",
  "custom-structure-import.xlsx",
);
mkdirSync(path.dirname(outPath), { recursive: true });
xlsx.writeFile(workbook, outPath);
console.log(`Wrote ${outPath}`);
