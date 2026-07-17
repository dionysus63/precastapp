// Regenerates public/templates/circular-structure-import.xlsx — the blank
// spreadsheet for bulk-importing circular structures into the quote
// workbook. Run: node scripts/generate-circular-import-template.mjs
import { mkdirSync } from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

const OPENING_GROUPS = 6;

const HEADERS = [
  "Structure #",
  "Template",
  "Diameter (ft)",
  "Rim Elev",
  "Low Invert (quote-only)",
  "Casting",
];
for (let i = 1; i <= OPENING_GROUPS; i += 1) {
  HEADERS.push(
    `Opening ${i} Material`,
    `Opening ${i} Size (in)`,
    `Opening ${i} Invert`,
    `Opening ${i} Angle (deg)`,
  );
}

function exampleRow(fields) {
  const row = new Array(HEADERS.length).fill("");
  Object.assign(row, fields);
  return row;
}

const EXAMPLE_ROWS = [
  // Quote-only: rim + low invert; pipes listed without inverts.
  exampleRow({
    0: "MH-1",
    1: "SC Sewer",
    2: 4,
    3: 100.25,
    4: 92.5,
    6: "PVC SDR35", 7: 8,
    10: "PVC SDR35", 11: 8,
  }),
  // Full drill-sheet detail: one opening group per pipe with an invert.
  exampleRow({
    0: "MH-2",
    1: "SC Sewer",
    2: 4,
    3: 101.4,
    6: "PVC SDR35", 7: 8, 8: 93.1, 9: 0,
    10: "PVC SDR35", 11: 8, 12: 93.2, 13: 180,
    14: "PVC SDR35", 15: 6, 16: 95.0, 17: 90,
  }),
  // Quote-only with no pipes at all.
  exampleRow({
    0: "DMH-1",
    1: "SC Sewer",
    2: 4,
    3: 98.6,
    4: 94.0,
  }),
];

const INSTRUCTIONS = [
  ["Circular Structure Import — How to fill this in"],
  [""],
  ["One structure per row. Each structure is unique (quantity is always 1)."],
  ["The Template column picks the wall thickness and slab setup; Diameter"],
  ["must be one of the diameters that template offers (each diameter is a"],
  ["registered mold in Settings -> Structure Molds)."],
  [""],
  ["QUOTE-ONLY structures (fast pricing, drill sheet made after award):"],
  ["  - Fill Rim Elev and Low Invert."],
  ["  - List pipes in the opening groups using Material + Size only."],
  ["  - Leave Invert and Angle blank in every group."],
  [""],
  ["FULL DRILL SHEET structures:"],
  ["  - Fill Rim Elev; leave Low Invert blank (it comes from the openings)."],
  ["  - Fill one opening group per pipe: Material + Size + Invert, plus the"],
  ["    plan Angle in degrees (same convention as the drill sheet form;"],
  ["    0 and blank both mean the default position)."],
  [""],
  ["Material can include the pipe type, e.g. \"PVC SDR35\" or \"RCP\"."],
  ["Casting is optional — blank uses the template's default casting."],
  ["Six opening groups are provided; if a structure needs more, add columns"],
  ["following the same pattern (Opening 7 Material, Opening 7 Size (in), ...)."],
  [""],
  ["The Example tab shows a quote-only manhole (MH-1), a full drill-sheet"],
  ["manhole (MH-2), and a structure with no pipes (DMH-1). Enter your real"],
  ["structures on the Structures tab — the app previews everything before"],
  ["anything is added to the quote."],
];

const workbook = xlsx.utils.book_new();

const colWidths = [
  { wch: 12 }, { wch: 22 }, { wch: 11 }, { wch: 9 }, { wch: 20 }, { wch: 16 },
];
for (let i = 0; i < OPENING_GROUPS; i += 1) {
  colWidths.push({ wch: 14 }, { wch: 8 }, { wch: 9 }, { wch: 10 });
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
const outPath = path.join(outDir, "circular-structure-import.xlsx");
xlsx.writeFile(workbook, outPath);
console.log(`Wrote ${outPath}`);
