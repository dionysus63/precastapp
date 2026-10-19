import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request (see
// job-po-numbering.test.ts). Job numbering, the drill-sheet calculator and
// the saved structures run real.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/job-folders", () => ({
  createJobFoldersForJob: vi.fn().mockResolvedValue("C:\\test-job-folders\\job"),
}));

import { createOneOffDrillSheets } from "@/app/quotes/one-off-actions";
import { prisma } from "@/lib/prisma";
import {
  buildRowsFromSetup,
  computeCircularOneOffRow,
  createEmptySetup,
  type OneOffCircularOptions,
} from "@/lib/quotes/one-off-drill-sheets";

const tag = `ONEOFF-${Date.now()}`;
// An odd mold size no real catalog uses, so the scratch row can't collide.
const DIAMETER = 9.37;

let templateId: string;
let diameterConfigId: string;
let options: OneOffCircularOptions;

beforeAll(async () => {
  const template = await prisma.structureTemplate.create({
    data: {
      name: `${tag} MH`,
      shape: "CIRCULAR",
      wallThicknessInches: 8,
      diameters: { create: { insideDiameterFeet: DIAMETER } },
    },
  });
  templateId = template.id;
  const config = await prisma.structureDiameterConfig.create({
    data: {
      insideDiameterFeet: DIAMETER,
      wallThicknessInches: 8,
      maxBaseHeightFeet: 4,
      maxRiserHeightFeet: 4,
      keyHeightFeet: 0.33,
    },
  });
  diameterConfigId = config.id;

  options = {
    templates: [
      {
        id: templateId,
        name: template.name,
        agencyStandard: null,
        wallThicknessInches: 8,
        baseSlabThicknessInches: 8,
        topSlabThicknessInches: 16,
        minimumBrickInches: 4,
        connectionType: "KOR_N_SEAL",
        sumpMode: "DEFAULT",
        sumpFixedInches: null,
        openingToJointMinTopInches: 4,
        openingToJointMinBottomInches: 4,
        topSlabOpeningInches: null,
        defaultCastingProductId: null,
        defaultCastingHeightFeet: null,
        diameters: [{ id: "d", insideDiameterFeet: DIAMETER }],
      },
    ],
    castings: [{ id: "cast", name: "Frame", heightFeet: 0.5 }],
    pipeOpeningSizes: [],
    diameterConfigs: [
      {
        label: null,
        insideDiameterFeet: DIAMETER,
        wallThicknessInches: 8,
        maxBaseHeightFeet: 4,
        maxRiserHeightFeet: 4,
        keyHeightFeet: 0.33,
        wallPricePerFoot: 0,
        basePrice: 0,
      },
    ],
  };
});

afterAll(async () => {
  await prisma.jobStructure.deleteMany({ where: { structureTemplateId: templateId } });
  await prisma.job.deleteMany({ where: { projectName: { startsWith: tag } } });
  await prisma.structureTemplate.deleteMany({ where: { id: templateId } });
  await prisma.structureDiameterConfig.deleteMany({ where: { id: diameterConfigId } });
  await prisma.$disconnect();
});

/** Grid rows → the config the client sends, with no casting product. */
function circularSheets(numbers: string[]) {
  const rows = buildRowsFromSetup(
    {
      ...createEmptySetup("CIRCULAR"),
      templateId,
      diameterFeet: String(DIAMETER),
      castingProductId: "cast",
      pipeType: "PVC",
      pipeSize: "8",
      quantity: String(numbers.length),
    },
    1,
  );
  return rows.map((row, index) => {
    row.rimElevation = "100";
    row.openings[0].invert = String(92 + index * 0.5);
    const result = computeCircularOneOffRow(row, options);
    expect(result.ready).toBe(true);
    return {
      shape: "CIRCULAR" as const,
      structureNumber: numbers[index],
      config: { ...result.config, castingProductId: null },
    };
  });
}

describe("createOneOffDrillSheets", () => {
  it("creates a new awarded job with one drill sheet per row", async () => {
    const result = await createOneOffDrillSheets({
      job: {
        mode: "new",
        customerId: null,
        customerName: "Walk-up Contractor",
        projectName: `${tag} New`,
        projectAddress: "1 Main St",
        city: "",
        state: "NY",
        zip: "",
        contactName: "",
        contactPhone: "",
        contactEmail: "",
      },
      sheets: circularSheets(["MH-1", "MH-2"]),
    });
    if ("error" in result) {
      throw new Error(result.error);
    }

    expect(result.jobCreated).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.sheets.map((sheet) => sheet.structureNumber)).toEqual([
      "MH-1",
      "MH-2",
    ]);

    const job = await prisma.job.findUniqueOrThrow({
      where: { id: result.jobId },
      include: {
        jobStructures: {
          orderBy: { structureNumber: "asc" },
          include: { calc: true, openings: true },
        },
      },
    });
    expect(job).toMatchObject({
      status: "AWARDED",
      customerName: "Walk-up Contractor",
      projectAddress: "1 Main St",
      state: "NY",
    });
    expect(job.awardedDate).not.toBeNull();
    expect(job.jobStructures).toHaveLength(2);
    expect(job.jobStructures[0]).toMatchObject({
      structureNumber: "MH-1",
      structureTemplateId: templateId,
    });
    expect(Number(job.jobStructures[0].quantity)).toBe(1);
    expect(job.jobStructures[0].calc?.contractorName).toBe("Walk-up Contractor");
    expect(job.jobStructures[1].openings).toHaveLength(1);
  });

  it("refuses numbers already on the job without writing anything", async () => {
    const job = await prisma.job.findFirstOrThrow({
      where: { projectName: `${tag} New` },
    });

    const result = await createOneOffDrillSheets({
      job: { mode: "existing", jobId: job.id },
      sheets: circularSheets(["MH-2", "MH-3"]),
    });
    expect(result).toEqual({
      error: expect.stringMatching(/Already on job .*MH-2/),
    });
    expect(
      await prisma.jobStructure.count({ where: { jobId: job.id } }),
    ).toBe(2);
  });

  it("adds sheets to an existing job", async () => {
    const job = await prisma.job.findFirstOrThrow({
      where: { projectName: `${tag} New` },
    });

    const result = await createOneOffDrillSheets({
      job: { mode: "existing", jobId: job.id },
      sheets: circularSheets(["MH-3"]),
    });
    if ("error" in result) {
      throw new Error(result.error);
    }
    expect(result.jobCreated).toBe(false);
    expect(
      await prisma.jobStructure.count({ where: { jobId: job.id } }),
    ).toBe(3);
  });

  it("rejects an incomplete row before creating the job", async () => {
    const [sheet] = circularSheets(["MH-1"]);
    const result = await createOneOffDrillSheets({
      job: {
        mode: "new",
        customerId: null,
        customerName: "Someone",
        projectName: `${tag} Never`,
        projectAddress: "",
        city: "",
        state: "",
        zip: "",
        contactName: "",
        contactPhone: "",
        contactEmail: "",
      },
      sheets: [
        sheet,
        { shape: "CIRCULAR", structureNumber: "MH-2", config: { templateId } },
      ],
    });
    expect(result).toEqual({
      error: expect.stringMatching(/MH-2: the circular sheet isn't complete/),
    });
    expect(
      await prisma.job.count({ where: { projectName: `${tag} Never` } }),
    ).toBe(0);
  });
});
