// Renders a set of stress-test rect sheets to PDFs so drawing changes can be
// eyeballed against the layouts that have caused clutter before.
//
// Run: npx tsx --env-file=.env scripts/render-rect-sheet-samples.ts [outDir]
// Creates temporary JobStructures against the first rectangular template
// (which must have a PDF set assigned) and deletes them afterwards.

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  createRectJobStructureFromPayload,
  type RectSheetPayload,
} from "@/lib/rect-sheet-persistence";
import { rectSheetDetailInclude } from "@/lib/rect-sheet-detail";
import { buildRectSheetPdfBytes } from "@/lib/rect-sheet-pdf-generate";

type Sample = { name: string; payload: Omit<RectSheetPayload, "templateId"> };

const base = {
  castingProductId: null as string | null,
  jobId: null as string | null,
  contractor: "Sample",
  project: "Render Samples",
  date: new Date().toISOString().slice(0, 10),
  inspection: "",
  approvedBy: "",
  hasTopSlab: true,
  hasBaseSlab: true,
  baseAttached: true,
  topSlabOpeningLengthInches: "30",
  topSlabOpeningWidthInches: "30",
  topSlabOpeningSide: "UP" as const,
  sectionHeightsFeet: [] as string[],
  jointKeys: [] as boolean[],
};

function opening(
  overrides: Partial<RectSheetPayload["openings"][number]> &
    Pick<RectSheetPayload["openings"][number], "label" | "wall" | "invertElevation">,
): RectSheetPayload["openings"][number] {
  return {
    pipeMaterial: "HDPE",
    pipeSizeInches: "12",
    angle: "",
    placement: "CENTERED",
    offsetInches: "",
    widthOverrideInches: "",
    ...overrides,
  };
}

const SAMPLES: Sample[] = [
  {
    // The DCB-1 clutter case: two Up-wall openings far apart on a tall
    // split wall — leaders used to cross and the upper fold dimension ran
    // through the lower opening.
    name: "same-wall-tall-split",
    payload: {
      ...base,
      structureNumber: "S1",
      rimElevation: "100",
      insideLengthFeet: "4",
      insideWidthFeet: "4",
      sectionHeightsFeet: ["5", "4"],
      jointKeys: [true],
      openings: [
        opening({ label: "A", wall: "UP", pipeSizeInches: "15", invertElevation: "90.6" }),
        opening({ label: "B", wall: "UP", pipeSizeInches: "24", invertElevation: "96.8" }),
      ],
    },
  },
  {
    // Three walls incl. a touch-end opening (the cb6-style spread).
    name: "three-walls",
    payload: {
      ...base,
      structureNumber: "S2",
      rimElevation: "100",
      insideLengthFeet: "4",
      insideWidthFeet: "4",
      openings: [
        opening({ label: "A", wall: "UP", pipeSizeInches: "15", invertElevation: "95" }),
        opening({ label: "B", wall: "DOWN", invertElevation: "96.6" }),
        opening({ label: "C", wall: "RIGHT", invertElevation: "97.4", placement: "TOUCH_LEFT" }),
      ],
    },
  },
  {
    // Left-wall opening (west callout lane) + split with joint label.
    name: "left-wall-split",
    payload: {
      ...base,
      structureNumber: "S3",
      rimElevation: "100",
      insideLengthFeet: "4",
      insideWidthFeet: "4",
      sectionHeightsFeet: ["2.5", "2"],
      jointKeys: [true],
      openings: [
        opening({ label: "A", wall: "LEFT", pipeSizeInches: "15", invertElevation: "95" }),
        opening({ label: "B", wall: "DOWN", invertElevation: "96.2" }),
      ],
    },
  },
  {
    // No-top variant with a split: joint lines must land on the taller
    // elevation wall band of the notopslab layouts.
    name: "no-top-split",
    payload: {
      ...base,
      structureNumber: "S4",
      rimElevation: "100",
      insideLengthFeet: "4",
      insideWidthFeet: "4",
      hasTopSlab: false,
      topSlabOpeningLengthInches: "",
      topSlabOpeningWidthInches: "",
      sectionHeightsFeet: ["2.5", "2"],
      jointKeys: [true],
      openings: [
        opening({ label: "A", wall: "UP", invertElevation: "95.5" }),
        opening({ label: "B", wall: "RIGHT", invertElevation: "96.4" }),
      ],
    },
  },
  {
    // Open bottom (X'd cross center): opening touching a wall end near the
    // fold line, plus a separate base weight must NOT print.
    name: "no-base-touch-end",
    payload: {
      ...base,
      structureNumber: "S5",
      rimElevation: "100",
      insideLengthFeet: "4",
      insideWidthFeet: "4",
      hasBaseSlab: false,
      baseAttached: false,
      openings: [
        opening({ label: "A", wall: "UP", pipeSizeInches: "15", invertElevation: "95.2", placement: "TOUCH_LEFT" }),
        opening({ label: "B", wall: "DOWN", invertElevation: "96.6" }),
      ],
    },
  },
  {
    // Fully open top + bottom on a single pour.
    name: "open-top-bottom",
    payload: {
      ...base,
      structureNumber: "S6",
      rimElevation: "100",
      insideLengthFeet: "6",
      insideWidthFeet: "4",
      hasTopSlab: false,
      hasBaseSlab: false,
      baseAttached: false,
      topSlabOpeningLengthInches: "",
      topSlabOpeningWidthInches: "",
      openings: [
        opening({ label: "A", wall: "LEFT", invertElevation: "96" }),
        opening({ label: "B", wall: "RIGHT", invertElevation: "96.8" }),
      ],
    },
  },
];

async function main() {
  const outDir = process.argv[2] || "C:/PrecastGeneratedPDFs/RectSamples";
  await mkdir(outDir, { recursive: true });

  const template = await prisma.structureTemplate.findFirst({
    where: { shape: "RECTANGULAR", rectPdfSetId: { not: null } },
  });
  if (!template) {
    throw new Error("No rectangular template with a PDF set assigned.");
  }

  for (const sample of SAMPLES) {
    const id = await createRectJobStructureFromPayload({
      ...sample.payload,
      templateId: template.id,
    });
    try {
      const sheet = await prisma.jobStructure.findUnique({
        where: { id },
        include: rectSheetDetailInclude,
      });
      if (!sheet) {
        throw new Error("sample sheet missing");
      }
      const built = await buildRectSheetPdfBytes(sheet);
      if (!built.ok) {
        throw new Error(`${sample.name}: ${built.error}`);
      }
      const file = path.join(outDir, `${sample.name}.pdf`);
      await writeFile(file, built.bytes);
      console.log("rendered", file);
    } finally {
      await prisma.jobStructure.delete({ where: { id } });
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
