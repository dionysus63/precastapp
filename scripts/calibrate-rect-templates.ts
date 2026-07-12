// LEGACY — superseded by scripts/import-rect-sheet-pdfs.ts (2026-07-10).
// Nick now authors fillable PDFs directly; this script's field names predate
// the current convention in lib/rect-template-pdf-fields.ts. Kept only to
// document how the old "Catch Basin Standard" set was produced.
//
// Calibrates Nick's 4-page rectangular-structure template PDF into four
// upload-ready fillable variants (top slab x base slab).
//
// For each page it: masks the sample values with white rectangles (redrawing
// static label prefixes where a label+value share one text item), places an
// AcroForm text field at each sample's measured position and font size, adds
// the piece-weights block in the upper right, and adds the invisible marker
// fields the app draws on (exploded view cross + center, top slab square).
//
// Run:  npx tsx scripts/calibrate-rect-templates.ts [source.pdf] [outDir]
// Then upload the four PDFs on the Structures → Rect PDF Sets page, or pass
// --upload-set <name-or-id> to create/update a shared PDF set directly.

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  PDFDocument,
  PDFName,
  StandardFonts,
  TextAlignment,
  rgb,
} from "pdf-lib";
import {
  RECT_ELEVATION_WALL_MARKER_FIELD,
  RECT_EXPLODED_CENTER_MARKER_FIELD,
  RECT_EXPLODED_MARKER_FIELD,
  RECT_TOP_SLAB_MARKER_FIELD,
} from "@/lib/rect-template-pdf-fields";

const DEFAULT_SOURCE =
  "C:/Users/Nick/OneDrive - Long Island Precast/Desktop/Catch Basin Drill Sheet Templates.pdf";
const DEFAULT_OUT_DIR = "assets/templates/rect-calibrated";

const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);

type Align = "left" | "center" | "right";

/** A sample text item to replace with a field (or mask entirely). */
type ValueSpec = {
  name: string;
  /** Exact sample string to find near [x, y] (page points, baseline). */
  sample: string;
  x: number;
  y: number;
  /** Static label prefix to redraw when the item includes it. */
  labelPrefix?: string;
  /** Field left edge when it differs from the sample's x (e.g. aligned columns). */
  fieldX?: number;
  width?: number;
  align?: Align;
  fontSize?: number;
};

/** A field with no sample text (empty cell); placed at explicit coords. */
type PlainSpec = {
  name: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  align?: Align;
  fontSize?: number;
};

type MarkerSpec = { name: string; x: number; y: number; width: number; height: number };

type TextItem = { str: string; x: number; y: number; w: number; h: number };

// ---------------------------------------------------------------------------
// Anchor tables (measured from the source PDF's text/vector dump)
// ---------------------------------------------------------------------------

const HEADER_SPECS: ValueSpec[] = [
  { name: "contractor", sample: "", labelPrefix: "Contractor:", x: 56, y: 470.8 },
  { name: "project", sample: "", labelPrefix: "Project:", x: 55.6, y: 458.6 },
  { name: "date", sample: "", labelPrefix: "Date:", x: 55.6, y: 446.2 },
  { name: "box_no", sample: "", labelPrefix: "Box #:", x: 55.6, y: 434 },
  { name: "wall_thickness", sample: "", labelPrefix: "Wall Thickness:", x: 56.2, y: 422 },
  { name: "base_note", sample: "", labelPrefix: "Base:", x: 55.6, y: 410, width: 110 },
  { name: "casting", sample: "", labelPrefix: "Casting:", x: 56, y: 398, width: 150 },
];

/** Math ladder values (right-aligned column ending near x=437). */
const LADDER_SPECS: ValueSpec[] = [
  { name: "rim_elevation", sample: "138.00", x: 406.9, y: 133.3 },
  { name: "low_invert", sample: "135.00", x: 406.9, y: 121.4 },
  { name: "invert_to_top", sample: "3.00", x: 412.6, y: 109.5 },
  { name: "casting_minus", sample: "0.25", x: 412.8, y: 97.7 },
  { name: "brick_minus", sample: "0.25", x: 412.8, y: 85.8 },
  { name: "top_slab_minus", sample: "0.00", x: 412.7, y: 73.9 },
  { name: "sump_plus", sample: "2.00", x: 412.6, y: 62 },
  { name: "wall_height", sample: "4.50", x: 412.7, y: 50.1 },
].map((spec) => ({ ...spec, align: "right" as Align, width: 44, fieldX: 393 }));

/** Exploded-view dimension texts (shared coords on all four pages). */
const EXPLODED_SPECS: ValueSpec[] = [
  { name: "inside_length_inches", sample: "24\"", x: 548.8, y: 517.3, align: "center", width: 44 },
  { name: "inside_width_inches", sample: "24\"", x: 359.9, y: 325.1, align: "center", width: 44 },
  { name: "wall_height_inches", sample: "54\"", x: 466.1, y: 444.1, align: "center", width: 40 },
];

/** Sample opening row A values (columns: INVERT | DIA | TYPE). */
const TABLE_SAMPLE_SPECS: ValueSpec[] = [
  { name: "invert_a", sample: "135.00", x: 127.4, y: 118.6, width: 56, fontSize: 10 },
  { name: "dia_a", sample: "8\"", x: 197.6, y: 118.6, width: 26, fontSize: 10 },
  { name: "type_a", sample: "HDPE", x: 228.7, y: 118.6, fieldX: 222, width: 39, fontSize: 8 },
];

/** Empty rows B-E at the same columns. */
const TABLE_ROW_YS: Record<string, number> = { b: 103.7, c: 88.9, d: 74, e: 59.2 };
const TABLE_PLAIN_SPECS: PlainSpec[] = Object.entries(TABLE_ROW_YS).flatMap(
  ([row, y]) => [
    { name: `invert_${row}`, x: 127.4, y, width: 56, fontSize: 10 },
    { name: `dia_${row}`, x: 197.6, y, width: 26, fontSize: 10 },
    { name: `type_${row}`, x: 222, y, width: 39, fontSize: 8 },
  ],
);

/** Piece-weights block, upper right (empty corner above the exploded view). */
const WEIGHT_BLOCK = { x: 638, width: 122, headerY: 572, firstLineY: 561, step: 9.5 };
const WEIGHT_SPECS: PlainSpec[] = [
  "weight_top_slab",
  "weight_piece_1",
  "weight_piece_2",
  "weight_piece_3",
  "weight_piece_4",
  "weight_base",
].map((name, index) => ({
  name,
  x: WEIGHT_BLOCK.x,
  y: WEIGHT_BLOCK.firstLineY - index * WEIGHT_BLOCK.step,
  width: WEIGHT_BLOCK.width,
  height: 9,
  fontSize: 7,
}));

const MARKERS: MarkerSpec[] = [
  { name: RECT_EXPLODED_MARKER_FIELD, x: 383.5, y: 154.2, width: 351, height: 351.2 },
  { name: RECT_EXPLODED_CENTER_MARKER_FIELD, x: 497.2, y: 267.8, width: 123.8, height: 123.8 },
];
const TOP_SLAB_MARKER: MarkerSpec = {
  name: RECT_TOP_SLAB_MARKER_FIELD,
  x: 320.3,
  y: 464.6,
  width: 80.2,
  height: 80.2,
};

/** Per-variant page config (page numbers are 1-based in the source PDF). */
type VariantConfig = {
  page: number;
  key: string;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  /** Elevation ladder rows: field name -> sample value + coords. */
  elevations: ValueSpec[];
  /** Thickness stack rows (left of the elevation). */
  thicknesses: ValueSpec[];
  /** Top slab detail dims (top-slab variants only). */
  topSlabDims: ValueSpec[];
  /** Elevation wall band (floor line up to top of walls), for joint lines. */
  elevationWallsY: { bottom: number; top: number };
};

const THICK: Pick<ValueSpec, "fieldX" | "align" | "width"> = {
  fieldX: 52,
  align: "right",
  width: 26,
};

const VARIANTS: VariantConfig[] = [
  {
    page: 1,
    key: "topslab-base",
    elevationWallsY: { bottom: 201.4, top: 299.1 },
    hasTopSlab: true,
    hasBaseSlab: true,
    elevations: [
      { name: "rim_elevation_drawing", sample: "138.00", x: 263.6, y: 332.9 },
      { name: "bottom_casting_elevation", sample: "137.75", x: 263.6, y: 321.2 },
      { name: "top_of_top_slab_elevation", sample: "137.50", x: 263.6, y: 309.6 },
      { name: "bottom_of_top_slab_elevation", sample: "137.50", x: 263.6, y: 295.6 },
      { name: "top_of_bottom_slab_elevation", sample: "133.00", x: 261.2, y: 197.9 },
      { name: "bottom_of_bottom_slab_elevation", sample: "132.50", x: 261.2, y: 183.9 },
    ],
    thicknesses: [
      { name: "casting_thickness_inches", sample: "3\"", x: 67.1, y: 329, ...THICK },
      { name: "brick_thickness_inches", sample: "3\"", x: 67.2, y: 315.4, ...THICK },
      { name: "top_slab_thickness_inches", sample: "0\"", x: 67.4, y: 301.7, ...THICK },
      { name: "wall_height_stack_inches", sample: "54\"", x: 64.4, y: 260.8, ...THICK },
      { name: "base_slab_thickness_inches", sample: "6\"", x: 67.1, y: 190.9, ...THICK },
    ],
    topSlabDims: [
      { name: "top_slab_width", sample: "64\"", x: 295.4, y: 501.5, align: "center", width: 34 },
      { name: "top_slab_length", sample: "64\"", x: 353.2, y: 453.1, align: "center", width: 34 },
    ],
  },
  {
    page: 2,
    key: "notopslab-nobase",
    elevationWallsY: { bottom: 215.3, top: 313.0 },
    hasTopSlab: false,
    hasBaseSlab: false,
    elevations: [
      { name: "rim_elevation_drawing", sample: "136.50", x: 263.6, y: 332.9 },
      { name: "bottom_casting_elevation", sample: "136.25", x: 263.6, y: 321.2 },
      { name: "top_of_wall_elevation", sample: "136.00", x: 263.6, y: 309.6 },
      { name: "top_of_bottom_slab_elevation", sample: "131.50", x: 261.2, y: 211.9 },
    ],
    thicknesses: [
      { name: "casting_thickness_inches", sample: "3\"", x: 67.1, y: 329, ...THICK },
      { name: "brick_thickness_inches", sample: "3\"", x: 67.2, y: 315.4, ...THICK },
      { name: "wall_height_stack_inches", sample: "54\"", x: 64.4, y: 260.8, ...THICK },
    ],
    topSlabDims: [],
  },
  {
    page: 3,
    key: "topslab-nobase",
    elevationWallsY: { bottom: 201.4, top: 299.1 },
    hasTopSlab: true,
    hasBaseSlab: false,
    elevations: [
      { name: "rim_elevation_drawing", sample: "134.25", x: 263.6, y: 332.9 },
      { name: "bottom_casting_elevation", sample: "133.83", x: 263.6, y: 321.2 },
      { name: "top_of_top_slab_elevation", sample: "133.25", x: 263.6, y: 309.6 },
      { name: "bottom_of_top_slab_elevation", sample: "133.25", x: 263.6, y: 295.6 },
      { name: "top_of_bottom_slab_elevation", sample: "129.25", x: 261.3, y: 197.9 },
    ],
    thicknesses: [
      { name: "casting_thickness_inches", sample: "5\"", x: 67.1, y: 329, ...THICK },
      { name: "brick_thickness_inches", sample: "7\"", x: 67.2, y: 315.4, ...THICK },
      { name: "top_slab_thickness_inches", sample: "0\"", x: 67.4, y: 301.7, ...THICK },
      { name: "wall_height_stack_inches", sample: "48\"", x: 64.5, y: 260.8, ...THICK },
    ],
    topSlabDims: [
      { name: "top_slab_width", sample: "64\"", x: 295.4, y: 501.5, align: "center", width: 34 },
      { name: "top_slab_length", sample: "64\"", x: 353.2, y: 453.1, align: "center", width: 34 },
    ],
  },
  {
    page: 4,
    key: "notopslab-base",
    elevationWallsY: { bottom: 215.4, top: 313.1 },
    hasTopSlab: false,
    hasBaseSlab: true,
    elevations: [
      { name: "rim_elevation_drawing", sample: "####", x: 264.4, y: 332.9 },
      { name: "bottom_casting_elevation", sample: "####", x: 264.4, y: 321.2 },
      { name: "top_of_wall_elevation", sample: "####", x: 264.4, y: 309.6 },
      { name: "top_of_bottom_slab_elevation", sample: "#####", x: 263.1, y: 211.9 },
      { name: "bottom_of_bottom_slab_elevation", sample: "0.00", x: 263.2, y: 197.9 },
    ],
    thicknesses: [
      { name: "casting_thickness_inches", sample: "#\"", x: 67.3, y: 329, ...THICK },
      { name: "brick_thickness_inches", sample: "#\"", x: 67.4, y: 315.4, ...THICK },
      { name: "wall_height_stack_inches", sample: "0\"", x: 67.3, y: 260.8, ...THICK },
      { name: "base_slab_thickness_inches", sample: "#\"", x: 67.4, y: 204.9, ...THICK },
    ],
    topSlabDims: [],
  },
];

// ---------------------------------------------------------------------------

async function extractTextItems(bytes: Uint8Array): Promise<TextItem[][]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const pages: TextItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // pdf.js text content mixes TextItem with marker entries that lack `str`.
    const rawItems = content.items as Array<{
      str?: string;
      transform: number[];
      width: number;
    }>;
    pages.push(
      rawItems.flatMap((it) =>
        it.str && it.str.trim()
          ? [
              {
                str: it.str.trim(),
                x: it.transform[4],
                y: it.transform[5],
                w: it.width,
                h: Math.hypot(it.transform[1], it.transform[3]),
              },
            ]
          : [],
      ),
    );
  }
  return pages;
}

function findItem(
  items: TextItem[],
  spec: { sample: string; labelPrefix?: string; x: number; y: number },
): TextItem | null {
  return (
    items.find((item) => {
      if (Math.abs(item.x - spec.x) > 6 || Math.abs(item.y - spec.y) > 6) {
        return false;
      }
      if (spec.labelPrefix) {
        return item.str.startsWith(spec.labelPrefix);
      }
      return item.str === spec.sample;
    }) ?? null
  );
}

const ALIGNMENTS: Record<Align, TextAlignment> = {
  left: TextAlignment.Left,
  center: TextAlignment.Center,
  right: TextAlignment.Right,
};

async function calibrateVariant(
  sourceBytes: Uint8Array,
  variant: VariantConfig,
  textPages: TextItem[][],
): Promise<{ bytes: Uint8Array; missing: string[] }> {
  const doc = await PDFDocument.load(sourceBytes.slice());
  // Keep only this variant's page.
  for (let i = doc.getPageCount() - 1; i >= 0; i--) {
    if (i !== variant.page - 1) {
      doc.removePage(i);
    }
  }
  const page = doc.getPage(0);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const items = textPages[variant.page - 1];
  const missing: string[] = [];
  const created = new Map<string, ReturnType<typeof form.createTextField>>();

  const addField = (
    name: string,
    rect: { x: number; y: number; width: number; height: number },
    fontSize: number,
    align: Align,
  ) => {
    let field = created.get(name);
    const isNew = !field;
    if (!field) {
      field = form.createTextField(name);
      field.setAlignment(ALIGNMENTS[align]);
      created.set(name, field);
    }
    field.addToPage(page, {
      ...rect,
      borderWidth: 0,
      textColor: BLACK,
      font,
    });
    // addToPage defaults to an opaque white background that would mask the
    // template's static labels; drop the appearance characteristics so the
    // widget stays transparent.
    field.acroField.getWidgets().at(-1)?.dict.delete(PDFName.of("MK"));
    if (isNew) {
      // setFontSize needs the DA entry that addToPage creates.
      field.setFontSize(fontSize);
    }
  };

  const placeValueSpec = (spec: ValueSpec) => {
    const item = findItem(items, spec);
    if (!item) {
      missing.push(`${spec.name} (${spec.labelPrefix ?? spec.sample})`);
      return;
    }
    // Mask the sample text: baseline minus descender up to the ascender,
    // without reaching into the line above.
    page.drawRectangle({
      x: item.x - 1,
      y: item.y - 3,
      width: item.w + 2,
      height: item.h * 0.82 + 3,
      color: WHITE,
    });

    let fieldWidth = spec.width ?? Math.max(item.w + 30, 60);
    // Centered fields center their box on the sample text's midpoint so the
    // printed value lands where the CAD dim sat.
    let fieldX =
      spec.fieldX ??
      (spec.align === "center"
        ? item.x + item.w / 2 - fieldWidth / 2
        : spec.x);
    const fontSize = spec.fontSize ?? Math.max(Math.round(item.h) - 2, 6);
    const height = item.h + 3;

    if (spec.labelPrefix) {
      // Redraw the static label, field follows it.
      const labelSize = item.h * 0.92;
      page.drawText(spec.labelPrefix, {
        x: item.x,
        y: item.y,
        size: labelSize,
        font,
        color: BLACK,
      });
      const labelWidth = font.widthOfTextAtSize(spec.labelPrefix, labelSize);
      fieldX = item.x + labelWidth + 3;
      fieldWidth = spec.width ?? 250 - labelWidth;
    }

    addField(
      spec.name,
      { x: fieldX, y: item.y - 2.5, width: fieldWidth, height },
      fontSize,
      spec.align ?? "left",
    );
  };

  const placePlainSpec = (spec: PlainSpec) => {
    addField(
      spec.name,
      {
        x: spec.x,
        y: spec.y - 2.5,
        width: spec.width,
        height: spec.height ?? 13,
      },
      spec.fontSize ?? 9,
      spec.align ?? "left",
    );
  };

  for (const spec of HEADER_SPECS) placeValueSpec(spec);
  for (const spec of LADDER_SPECS) placeValueSpec(spec);
  for (const spec of EXPLODED_SPECS) placeValueSpec(spec);
  for (const spec of TABLE_SAMPLE_SPECS) placeValueSpec(spec);
  for (const spec of variant.elevations) placeValueSpec(spec);
  for (const spec of variant.thicknesses) placeValueSpec(spec);
  for (const spec of variant.topSlabDims) placeValueSpec(spec);
  for (const spec of TABLE_PLAIN_SPECS) placePlainSpec(spec);

  // Piece-weights block header + fields.
  page.drawText("PIECE WEIGHTS", {
    x: WEIGHT_BLOCK.x,
    y: WEIGHT_BLOCK.headerY,
    size: 8,
    font,
    color: BLACK,
  });
  page.drawLine({
    start: { x: WEIGHT_BLOCK.x, y: WEIGHT_BLOCK.headerY - 2.5 },
    end: { x: WEIGHT_BLOCK.x + 62, y: WEIGHT_BLOCK.headerY - 2.5 },
    thickness: 0.6,
    color: BLACK,
  });
  for (const spec of WEIGHT_SPECS) placePlainSpec(spec);

  // Invisible markers.
  const elevationWallsMarker: MarkerSpec = {
    name: RECT_ELEVATION_WALL_MARKER_FIELD,
    x: 100.3,
    y: variant.elevationWallsY.bottom,
    width: 148.9,
    height: variant.elevationWallsY.top - variant.elevationWallsY.bottom,
  };
  const markers = variant.hasTopSlab
    ? [...MARKERS, elevationWallsMarker, TOP_SLAB_MARKER]
    : [...MARKERS, elevationWallsMarker];
  for (const marker of markers) {
    const field = form.createTextField(marker.name);
    field.addToPage(page, {
      x: marker.x,
      y: marker.y,
      width: marker.width,
      height: marker.height,
      borderWidth: 0,
    });
  }

  form.updateFieldAppearances(font);
  return { bytes: await doc.save(), missing };
}

async function main() {
  const source = process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : DEFAULT_SOURCE;
  const outDir = process.argv[3] && !process.argv[3].startsWith("--")
    ? process.argv[3]
    : DEFAULT_OUT_DIR;
  const uploadIdx = process.argv.indexOf("--upload-set");
  const uploadSet = uploadIdx >= 0 ? process.argv[uploadIdx + 1] : null;

  const sourceBytes = new Uint8Array(await readFile(source));
  const textPages = await extractTextItems(sourceBytes);
  await mkdir(outDir, { recursive: true });

  const outputs: { variant: VariantConfig; file: string; bytes: Uint8Array }[] = [];
  for (const variant of VARIANTS) {
    const { bytes, missing } = await calibrateVariant(
      sourceBytes,
      variant,
      textPages,
    );
    const file = path.join(outDir, `${variant.key}.pdf`);
    await writeFile(file, bytes);
    outputs.push({ variant, file, bytes });
    console.log(
      `${variant.key}: ${file}${missing.length ? `  MISSING ANCHORS: ${missing.join(", ")}` : ""}`,
    );
  }

  if (uploadSet) {
    const { prisma } = await import("@/lib/prisma");
    const { saveRectPdfSetFile } = await import("@/lib/rect-pdf-set-service");
    const set =
      (await prisma.rectSheetPdfSet.findFirst({
        where: { OR: [{ id: uploadSet }, { name: uploadSet }] },
      })) ??
      (await prisma.rectSheetPdfSet.create({ data: { name: uploadSet } }));
    for (const { variant, bytes } of outputs) {
      await saveRectPdfSetFile(
        prisma,
        set.id,
        { hasTopSlab: variant.hasTopSlab, hasBaseSlab: variant.hasBaseSlab },
        new File([Buffer.from(bytes)], `${variant.key}.pdf`, {
          type: "application/pdf",
        }),
      );
      console.log(`uploaded ${variant.key} to PDF set "${set.name}"`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
