// Regenerates public/templates/rect-structure-import.xlsx — the blank
// spreadsheet for bulk-importing rectangular structures into the quote
// workbook. Run: node scripts/generate-rect-import-template.mjs
import { mkdirSync } from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

const OPENING_GROUPS = 6;

const HEADERS = [
  "Structure #",
  "Template",
  "Rim Elev",
  "Low Invert (quote-only)",
  "Casting",
];
for (let i = 1; i <= OPENING_GROUPS; i += 1) {
  HEADERS.push(
    `Opening ${i} Wall`,
    `Opening ${i} Material`,
    `Opening ${i} Size (in)`,
    `Opening ${i} Invert`,
    `Opening ${i} Offset from Left (in)`,
  );
}

function exampleRow(fields) {
  const row = new Array(HEADERS.length).fill("");
  Object.assign(row, fields);
  return row;
}

const EXAMPLE_ROWS = [
  // Quote-only: rim + low invert; pipes listed without walls or inverts.
  exampleRow({
    0: "CB-1",
    1: "4' x 4' Standard CB",
    2: 100.25,
    3: 96.5,
    6: "RCP", 7: 15,
    11: "RCP", 12: 15,
    16: "PVC", 17: 6,
  }),
  // Full drill sheet: one opening group per pipe with Wall + Invert.
  exampleRow({
    0: "CB-2",
    1: "4' x 4' Standard CB",
    2: 101.1,
    5: "Up", 6: "RCP", 7: 15, 8: 96.8,
    10: "Down", 11: "RCP", 12: 15, 13: 96.9,
    15: "Left", 16: "PVC", 17: 6, 18: 97.5, 19: 18,
  }),
  // Quote-only with no pipes at all.
  exampleRow({
    0: "DB-1",
    1: "4'x2.5' CB - No Top or Bottom",
    2: 98.0,
    3: 95.0,
  }),
];

const INSTRUCTIONS = [
  ["Rectangular Structure Import — How to fill this in"],
  [""],
  ["One structure per row. Each structure is unique (quantity is always 1)."],
  ["The Template column picks the size, wall thickness, and which slabs the"],
  ["structure has — that all comes from the template, so there are no size or"],
  ["slab columns here."],
  [""],
  ["QUOTE-ONLY structures (fast pricing, drill sheet made after award):"],
  ["  - Fill Rim Elev and Low Invert."],
  ["  - List pipes in the opening groups using Material + Size only."],
  ["  - Leave Wall and Invert blank in every group."],
  [""],
  ["FULL DRILL SHEET structures:"],
  ["  - Fill Rim Elev; leave Low Invert blank (it comes from the openings)."],
  ["  - Fill one opening group per pipe: Wall + Material + Size + Invert."],
  ["  - Wall is the plan-view side: Up, Down, Left, Right (N/S/E/W also"],
  ["    accepted: N=Up, S=Down, W=Left, E=Right)."],
  ["  - Offset from Left is optional: the opening centerline measured in"],
  ["    inches from the wall's left inside face (looking at the plan)."],
  ["    Blank = centered on the wall."],
  [""],
  ["Casting is optional — blank uses the template's default casting."],
  ["Six opening groups are provided; if a structure needs more, add columns"],
  ["following the same pattern (Opening 7 Wall, Opening 7 Material, ...)."],
  [""],
  ["The Example tab shows a quote-only structure (CB-1), a full drill-sheet"],
  ["structure (CB-2), and a structure with no pipes (DB-1). Enter your real"],
  ["structures on the Structures tab — the app previews everything before"],
  ["anything is added to the quote."],
];

const workbook = xlsx.utils.book_new();

const colWidths = [
  { wch: 12 }, { wch: 28 }, { wch: 9 }, { wch: 20 }, { wch: 16 },
];
for (let i = 0; i < OPENING_GROUPS; i += 1) {
  colWidths.push({ wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 9 }, { wch: 12 });
}

const structuresSheet = xlsx.utils.aoa_to_sheet([HEADERS]);
structuresSheet["!cols"] = colWidths;
xlsx.utils.book_append_sheet(workbook, structuresSheet, "Structures");

const exampleSheet = xlsx.utils.aoa_to_sheet([HEADERS, ...EXAMPLE_ROWS]);
exampleSheet["!cols"] = colWidths;
xlsx.utils.book_append_sheet(workbook, exampleSheet, "Example");

const instructionsSheet = xlsx.utils.aoa_to_sheet(INSTRUCTIONS);
instructionsSheet["!cols"] = [{ wch: 78 }];
xlsx.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

const outDir = path.resolve("public", "templates");
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "rect-structure-import.xlsx");
xlsx.writeFile(workbook, outPath);
console.log(`Wrote ${outPath}`);
