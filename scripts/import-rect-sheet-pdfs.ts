// Enriches Nick's four fillable rectangular drill-sheet PDFs ("Yes Top Yes
// Bottom.pdf" etc., the top-slab x base-slab matrix) into upload-ready
// template variants: injects the invisible marker fields the app draws on
// (exploded-view cross + center, elevation wall band, top-slab square) and
// the piece-weights block (drawn header + weight_* fields). The PDFs already
// carry their own data fields (see lib/rect-template-pdf-fields.ts), so no
// masking/field-placement pass is needed — that was the old
// scripts/calibrate-rect-templates.ts flow for the field-less AutoCAD master.
//
// The enriched masters written to the out dir are the files to revise from:
// edit them (fields ride along) and re-upload on Structures → Rect PDF Sets.
// If a future revision is rebuilt from raw artwork, re-run this script.
//
// Run:  npx tsx --env-file=.env scripts/import-rect-sheet-pdfs.ts [sourceDir] [outDir]
//   --dump                    print each variant's existing field widget
//                             rects (coordinate anchors) and exit
//   --debug                   also write <key>.debug.pdf with stroked
//                             marker/weights rects for eyeball calibration
//   --upload-set <name-or-id> create/find a RectSheetPdfSet and upload the
//                             four enriched variants into it
//   --assign-all              with --upload-set: point every RECTANGULAR
//                             structure template at the uploaded set

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
import {
  RECT_ELEVATION_WALL_MARKER_FIELD,
  RECT_EXPLODED_CENTER_MARKER_FIELD,
  RECT_EXPLODED_MARKER_FIELD,
  RECT_TOP_SLAB_MARKER_FIELD,
  rectVariantExpectedFieldNames,
} from "@/lib/rect-template-pdf-fields";
import { rectTemplateVariantKey } from "@/lib/structure-template-pdf-service";

const DEFAULT_SOURCE_DIR =
  "C:/Users/Nick/OneDrive - Long Island Precast/Desktop";
const DEFAULT_OUT_DIR = "assets/templates/rect-imported";

const BLACK = rgb(0, 0, 0);

type Rect = { x: number; y: number; width: number; height: number };

type VariantConfig = {
  fileName: string;
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
  /**
   * Elevation wall band (bottom of walls up to top of walls) for the
   * rect_elevation_walls marker; joint lines draw across it on splits.
   */
  elevationWallsY: { bottom: number; top: number };
};

const VARIANTS: VariantConfig[] = [
  {
    fileName: "Yes Top Yes Bottom.pdf",
    hasTopSlab: true,
    hasBaseSlab: true,
    elevationWallsY: { bottom: 201.4, top: 299.2 },
  },
  {
    fileName: "Yes Top No Bottom.pdf",
    hasTopSlab: true,
    hasBaseSlab: false,
    elevationWallsY: { bottom: 201.4, top: 299.2 },
  },
  {
    fileName: "No Top Yes Bottom.pdf",
    hasTopSlab: false,
    hasBaseSlab: true,
    elevationWallsY: { bottom: 215.3, top: 313.1 },
  },
  {
    fileName: "No Top No Bottom.pdf",
    hasTopSlab: false,
    hasBaseSlab: false,
    elevationWallsY: { bottom: 215.3, top: 313.1 },
  },
];

// Coordinates measured from the PDFs' vector content (pdfjs operator dump,
// 2026-07-10); Nick rebuilt the sheets from the same CAD artwork as the old
// calibrated master, so the cross/center/top-slab geometry is unchanged.
// Re-measure (or iterate --debug) after any layout revision.
const SHARED_MARKERS: { name: string; rect: Rect }[] = [
  {
    name: RECT_EXPLODED_MARKER_FIELD,
    rect: { x: 383.5, y: 154.2, width: 351.1, height: 351.1 },
  },
  {
    name: RECT_EXPLODED_CENTER_MARKER_FIELD,
    rect: { x: 497.2, y: 267.8, width: 123.7, height: 123.8 },
  },
];
const TOP_SLAB_MARKER: { name: string; rect: Rect } = {
  name: RECT_TOP_SLAB_MARKER_FIELD,
  rect: { x: 320.3, y: 464.6, width: 80.1, height: 80.2 },
};
const ELEVATION_WALLS_X = { x: 100.3, width: 148.9 };

/** Piece-weights block in the blank corner above the exploded view. */
const WEIGHT_BLOCK = { x: 638, width: 122, headerY: 572, firstLineY: 561, step: 9.5 };
function weightFieldNamesFor(variant: {
  hasTopSlab: boolean;
  hasBaseSlab: boolean;
}): string[] {
  return [
    ...(variant.hasTopSlab ? ["weight_top_slab"] : []),
    "weight_piece_1",
    "weight_piece_2",
    "weight_piece_3",
    "weight_piece_4",
    ...(variant.hasBaseSlab ? ["weight_base"] : []),
  ];
}

function markersForVariant(variant: VariantConfig): { name: string; rect: Rect }[] {
  const markers = [
    ...SHARED_MARKERS,
    {
      name: RECT_ELEVATION_WALL_MARKER_FIELD,
      rect: {
        x: ELEVATION_WALLS_X.x,
        y: variant.elevationWallsY.bottom,
        width: ELEVATION_WALLS_X.width,
        height: variant.elevationWallsY.top - variant.elevationWallsY.bottom,
      },
    },
  ];
  if (variant.hasTopSlab) {
    markers.push(TOP_SLAB_MARKER);
  }
  return markers;
}

async function dumpVariant(variant: VariantConfig, bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes.slice());
  const key = rectTemplateVariantKey(variant.hasTopSlab, variant.hasBaseSlab);
  console.log(`\n=== ${key} (${variant.fileName})`);
  for (const field of doc.getForm().getFields()) {
    const widget = field.acroField.getWidgets()[0];
    if (!widget) {
      console.log(`  ${field.getName()}  (no widget)`);
      continue;
    }
    const r = widget.getRectangle();
    console.log(
      `  ${field.getName().padEnd(34)} x=${r.x.toFixed(1)} y=${r.y.toFixed(1)} w=${r.width.toFixed(1)} h=${r.height.toFixed(1)}`,
    );
  }
}

async function writeDebugOverlay(
  variant: VariantConfig,
  bytes: Uint8Array,
  outDir: string,
) {
  const doc = await PDFDocument.load(bytes.slice());
  const page = doc.getPage(0);
  for (const marker of markersForVariant(variant)) {
    page.drawRectangle({
      ...marker.rect,
      borderColor: rgb(1, 0, 0),
      borderWidth: 1,
    });
  }
  const weightNames = weightFieldNamesFor(variant);
  for (let i = 0; i < weightNames.length; i += 1) {
    page.drawRectangle({
      x: WEIGHT_BLOCK.x,
      y: WEIGHT_BLOCK.firstLineY - i * WEIGHT_BLOCK.step - 2.5,
      width: WEIGHT_BLOCK.width,
      height: 9,
      borderColor: rgb(0, 0.4, 1),
      borderWidth: 0.7,
    });
  }
  const key = rectTemplateVariantKey(variant.hasTopSlab, variant.hasBaseSlab);
  const file = path.join(outDir, `${key}.debug.pdf`);
  await writeFile(file, await doc.save());
  console.log(`debug overlay: ${file}`);
}

async function enrichVariant(
  variant: VariantConfig,
  bytes: Uint8Array,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes.slice());
  const page = doc.getPage(0);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Piece-weights block: drawn header + one field per line.
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
  // addToPage defaults to an opaque white background that would mask the
  // template artwork; drop the appearance characteristics so widgets stay
  // transparent (same trick as the legacy calibrate script).
  const makeTransparent = (field: { acroField: { getWidgets(): { dict: { delete(k: PDFName): void } }[] } }) => {
    field.acroField.getWidgets().at(-1)?.dict.delete(PDFName.of("MK"));
  };

  const weightNames = weightFieldNamesFor(variant);
  for (let i = 0; i < weightNames.length; i += 1) {
    const field = form.createTextField(weightNames[i]);
    field.addToPage(page, {
      x: WEIGHT_BLOCK.x,
      y: WEIGHT_BLOCK.firstLineY - i * WEIGHT_BLOCK.step - 2.5,
      width: WEIGHT_BLOCK.width,
      height: 9,
      borderWidth: 0,
      textColor: BLACK,
      font,
    });
    makeTransparent(field);
    field.setFontSize(7);
  }

  // Invisible markers the renderer consumes.
  for (const marker of markersForVariant(variant)) {
    const field = form.createTextField(marker.name);
    field.addToPage(page, {
      ...marker.rect,
      borderWidth: 0,
    });
    makeTransparent(field);
  }

  form.updateFieldAppearances(font);
  return doc.save();
}

async function main() {
  const positional = process.argv
    .slice(2)
    .filter((arg, i, args) => !arg.startsWith("--") && args[i - 1] !== "--upload-set");
  const sourceDir = positional[0] ?? DEFAULT_SOURCE_DIR;
  const outDir = positional[1] ?? DEFAULT_OUT_DIR;
  const dump = process.argv.includes("--dump");
  const debug = process.argv.includes("--debug");
  const assignAll = process.argv.includes("--assign-all");
  const uploadIdx = process.argv.indexOf("--upload-set");
  const uploadSet = uploadIdx >= 0 ? process.argv[uploadIdx + 1] : null;
  if (assignAll && !uploadSet) {
    throw new Error("--assign-all requires --upload-set <name-or-id>.");
  }

  await mkdir(outDir, { recursive: true });

  const outputs: { variant: VariantConfig; key: string; bytes: Uint8Array }[] = [];
  for (const variant of VARIANTS) {
    const key = rectTemplateVariantKey(variant.hasTopSlab, variant.hasBaseSlab);
    const sourceBytes = new Uint8Array(
      await readFile(path.join(sourceDir, variant.fileName)),
    );

    if (dump) {
      await dumpVariant(variant, sourceBytes);
      continue;
    }
    if (debug) {
      await writeDebugOverlay(variant, sourceBytes, outDir);
    }

    const bytes = await enrichVariant(variant, sourceBytes);

    // Coverage check against the per-variant convention.
    const { listTemplatePdfFields } = await import(
      "@/lib/drill-sheet-template-pdf"
    );
    const coverage = await listTemplatePdfFields(
      bytes,
      rectVariantExpectedFieldNames(variant.hasTopSlab, variant.hasBaseSlab),
    );
    const notes = [
      coverage.missingFromPdf.length
        ? `MISSING: ${coverage.missingFromPdf.join(", ")}`
        : null,
      coverage.unmatched.length
        ? `UNMATCHED: ${coverage.unmatched.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("  ");

    const file = path.join(outDir, `${key}.pdf`);
    await writeFile(file, bytes);
    outputs.push({ variant, key, bytes });
    console.log(
      `${key}: ${file}  (${coverage.matched.length} fields matched)${notes ? `  ${notes}` : ""}`,
    );
  }

  if (dump || outputs.length === 0) {
    return;
  }

  if (uploadSet) {
    const { prisma } = await import("@/lib/prisma");
    const { saveRectPdfSetFile } = await import("@/lib/rect-pdf-set-service");
    const set =
      (await prisma.rectSheetPdfSet.findFirst({
        where: { OR: [{ id: uploadSet }, { name: uploadSet }] },
      })) ??
      (await prisma.rectSheetPdfSet.create({ data: { name: uploadSet } }));
    for (const { variant, key, bytes } of outputs) {
      await saveRectPdfSetFile(
        prisma,
        set.id,
        { hasTopSlab: variant.hasTopSlab, hasBaseSlab: variant.hasBaseSlab },
        new File([Buffer.from(bytes)], `${key}.pdf`, {
          type: "application/pdf",
        }),
      );
      console.log(`uploaded ${key} to PDF set "${set.name}"`);
    }

    if (assignAll) {
      const updated = await prisma.structureTemplate.updateMany({
        where: { shape: "RECTANGULAR" },
        data: { rectPdfSetId: set.id },
      });
      console.log(
        `assigned PDF set "${set.name}" to ${updated.count} rectangular template(s)`,
      );
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
