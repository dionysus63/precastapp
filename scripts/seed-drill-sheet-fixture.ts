// Seeds (or replaces) a single drill sheet fixture that reproduces the
// reference image at docs/drill-sheet-target.png exactly, so screenshots of
// it are directly comparable region-by-region against that target.
//
// Run with: npx tsx scripts/seed-drill-sheet-fixture.ts
import "dotenv/config";
import { Prisma } from "../app/generated/prisma/client";
import { prisma } from "../lib/prisma";

const MANHOLE_NUMBER = "SMH-3";

async function main() {
  const template = await prisma.structureTemplate.findFirst({
    where: { shape: "CIRCULAR" },
  });
  if (!template) {
    throw new Error(
      "No circular StructureTemplate found. Seed one (e.g. via prisma/seed.ts) before running this fixture script.",
    );
  }

  const existing = await prisma.jobStructure.findFirst({
    where: { structureNumber: MANHOLE_NUMBER, jobId: null },
    select: { id: true },
  });
  if (existing) {
    await prisma.jobStructure.delete({ where: { id: existing.id } });
  }

  const created = await prisma.jobStructure.create({
    data: {
      structureType: "CONFIGURABLE_PRODUCT",
      structureTemplateId: template.id,
      structureNumber: MANHOLE_NUMBER,
      description: "4' Circular Manhole",
      quantity: new Prisma.Decimal("1"),
      unit: "EA",
      manholeDetail: {
        create: {
          manholeStandard: template.agencyStandard,
          contractorName: "Darr",
          projectName: "AC Hotel",
          sheetDate: new Date("2025-11-19T00:00:00"),
          hasSteps: false,
          rimElevation: new Prisma.Decimal("89.68"),
          lowestInvertElevation: new Prisma.Decimal("76.70"),
          requiredWallHeight: new Prisma.Decimal("10.50"),
          invertToTopFeet: new Prisma.Decimal("12.98"),
          castingHeightFeet: new Prisma.Decimal("0.67"),
          topSlabHeightFeet: new Prisma.Decimal("1.08"),
          sumpFeet: new Prisma.Decimal("0.17"),
          brickAdjustmentFeet: new Prisma.Decimal("0.90"),
          hasKey: true,
          insideDiameter: new Prisma.Decimal("4"),
        },
      },
      openings: {
        create: [
          {
            openingNumber: 1,
            wallLocation: "A",
            pipeType: "PVC",
            pipeDiameter: new Prisma.Decimal("8"),
            invertElevation: new Prisma.Decimal("76.70"),
            holeDiameter: new Prisma.Decimal("12"),
            bootType: "Kor-N-Seal",
            angle: new Prisma.Decimal("0"),
          },
          {
            openingNumber: 2,
            wallLocation: "B",
            pipeType: "PVC",
            pipeDiameter: new Prisma.Decimal("8"),
            invertElevation: new Prisma.Decimal("76.80"),
            holeDiameter: new Prisma.Decimal("12"),
            bootType: "Kor-N-Seal",
            // The reference image places B on the lower-right of the circle
            // (between the straight-down and lower-right spokes), not
            // lower-left — confirmed by inspecting docs/drill-sheet-target.png
            // directly rather than going by a paraphrased description.
            angle: new Prisma.Decimal("150"),
          },
        ],
      },
      sections: {
        create: [
          { role: "BASE", heightFeet: new Prisma.Decimal("4.5"), sortOrder: 0 },
          { role: "RISER", heightFeet: new Prisma.Decimal("6.0"), sortOrder: 1 },
        ],
      },
      castings: {
        create: {
          castingDescription: 'NCDPW Adjustable "SEWER"',
          quantity: new Prisma.Decimal("1"),
        },
      },
    },
  });

  console.log(`Seeded drill sheet ${MANHOLE_NUMBER} -> id ${created.id}`);
  console.log(`Preview:   http://localhost:3000/drill-sheets/${created.id}/preview`);
  console.log(`Render API: http://localhost:3000/api/drill-sheets/${created.id}/render-html`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
