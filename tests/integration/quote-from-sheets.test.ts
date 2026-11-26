import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request (see
// one-off-drill-sheets.test.ts). Quick Build's create action, the drill
// sheet calculator, the price lists and the quote lines run real.
const actor = vi.hoisted(() => ({ id: "", displayName: "Test User" }));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn(async () => actor),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/job-folders", () => ({
  createJobFoldersForJob: vi.fn().mockResolvedValue("C:\\test-job-folders\\job"),
}));

import { createOneOffDrillSheets } from "@/app/quotes/one-off-actions";
import { createDrillSheetsFromQuote } from "@/app/quotes/structure-actions";
import { loadDrillSheetFormOptions } from "@/lib/drill-sheet-options";
import { prisma } from "@/lib/prisma";
import {
  buildRowsFromSetup,
  computeCircularOneOffRow,
  createEmptySetup,
  stepRowWallHeight,
  type OneOffCircularOptions,
} from "@/lib/quotes/one-off-drill-sheets";
import {
  loadQuoteLinesFromJobSheets,
  loadSheetsForQuote,
  summarizeSheetsForQuote,
} from "@/lib/quotes/quote-from-sheets-load";
import type { QuoteStructureConfig } from "@/lib/quotes/structure-workbook";

const tag = `QFS-${Date.now()}`;
// An odd mold size no real catalog uses, so the scratch row can't collide.
const DIAMETER = 9.41;
const BASE_PRICE = 500;
const WALL_PER_FOOT = 150;
const CASTING_PRICE = 385.5;

let priceListId: string;
let templateId: string;
let diameterConfigId: string;
let categoryId: string;
let castingId: string;
let jobId: string;
/** What Quick Build worked out for each row, by structure number. */
const built = new Map<string, QuoteStructureConfig>();

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username: `${tag}-user`.toLowerCase(),
      displayName: `${tag} User`,
      initials: "TU",
      role: "MANAGER",
    },
  });
  actor.id = user.id;
  const priceList = await prisma.priceList.create({ data: { name: `${tag} List` } });
  priceListId = priceList.id;
  const category = await prisma.productCategory.create({
    data: { name: `${tag} Castings`, productType: "CASTING" },
  });
  categoryId = category.id;
  const casting = await prisma.product.create({
    data: {
      productCode: `${tag}-FC`,
      name: `${tag} Frame & Cover`,
      productType: "CASTING",
      categoryId,
      isCasting: true,
      heightFeet: 0.5,
      weight: 310,
      priceListItems: { create: { priceListId, unitPrice: CASTING_PRICE } },
    },
  });
  castingId = casting.id;
  const template = await prisma.structureTemplate.create({
    data: {
      name: `${tag} MH`,
      shape: "CIRCULAR",
      wallThicknessInches: 8,
      castingProductId: castingId,
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
      priceEntries: {
        create: { priceListId, wallPricePerFoot: WALL_PER_FOOT, basePrice: BASE_PRICE },
      },
    },
  });
  diameterConfigId = config.id;

  // The rows as Quick Build's grid builds them, priced from the test list.
  const loaded = await loadDrillSheetFormOptions(priceListId);
  const options: OneOffCircularOptions = {
    templates: loaded.templateOptions,
    castings: loaded.castingOptions,
    pipeOpeningSizes: loaded.pipeOpeningSizes,
    diameterConfigs: loaded.diameterConfigs,
  };
  const numbers = ["MH-10", "MH-2", "MH-1"];
  const rows = buildRowsFromSetup(
    {
      ...createEmptySetup("CIRCULAR"),
      templateId,
      diameterFeet: String(DIAMETER),
      castingProductId: castingId,
      pipeType: "PVC",
      pipeSize: "8",
      quantity: String(numbers.length),
    },
    1,
  );
  const sheets = rows.map((initial, index) => {
    let row = initial;
    row.rimElevation = String(100 + index);
    row.openings[0].invert = String(92 + index * 0.5);
    if (numbers[index] === "MH-2") {
      // The wall lowered 6" by hand: part of the price.
      row = stepRowWallHeight(row, -1);
    }
    const result = computeCircularOneOffRow(row, options);
    expect(result.ready, result.status).toBe(true);
    built.set(numbers[index], result.config as QuoteStructureConfig);
    return {
      shape: "CIRCULAR" as const,
      structureNumber: numbers[index],
      config: result.config,
    };
  });

  const created = await createOneOffDrillSheets({
    job: {
      mode: "new",
      customerId: null,
      customerName: "Walk-up Contractor",
      projectName: `${tag} Job`,
      projectAddress: "1 Main St",
      city: "",
      state: "NY",
      zip: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
    },
    sheets,
  });
  if ("error" in created) {
    throw new Error(created.error);
  }
  expect(created.errors).toEqual([]);
  jobId = created.jobId;
});

afterAll(async () => {
  await prisma.quote.deleteMany({ where: { jobId } });
  await prisma.jobStructure.deleteMany({ where: { structureTemplateId: templateId } });
  await prisma.job.deleteMany({ where: { projectName: { startsWith: tag } } });
  await prisma.structureTemplate.deleteMany({ where: { id: templateId } });
  await prisma.structureDiameterConfig.deleteMany({ where: { id: diameterConfigId } });
  await prisma.product.deleteMany({ where: { id: castingId } });
  await prisma.productCategory.deleteMany({ where: { id: categoryId } });
  await prisma.priceList.deleteMany({ where: { id: priceListId } });
  await prisma.user.deleteMany({ where: { id: actor.id } });
  await prisma.$disconnect();
});

/** A quote on the job with one structure line per number. */
async function createQuote(numbers: string[], quoteNumber: string) {
  return prisma.quote.create({
    data: {
      quoteNumber: `${tag}-${quoteNumber}`,
      jobId,
      customerName: "Walk-up Contractor",
      projectName: `${tag} Job`,
      lineItems: {
        create: numbers.map((number, index) => ({
          lineNumber: index + 1,
          lineType: "CONFIGURABLE_STRUCTURE" as const,
          // Typed by hand on a quote, so not always in the sheet's own case.
          itemCode: number.toLowerCase(),
          quantity: 1,
          unitPrice: 100,
          total: 100,
          structureConfigJson: built.get(number) as object,
        })),
      },
    },
  });
}

describe("a quote from a job's saved Quick Build sheets", () => {
  it("lists every structure at Quick Build's own price, then the castings", async () => {
    const result = await loadQuoteLinesFromJobSheets(jobId, null, priceListId);

    expect(result.structureCount).toBe(3);
    expect(result.leftOut).toEqual([]);
    expect(result.unpriced).toEqual([]);
    // MH-2 before MH-10, as numbers and not as text.
    expect(result.lineItems.map((line) => [line.lineNumber, line.type, line.item])).toEqual([
      [1, "CONFIGURABLE_STRUCTURE", "MH-1"],
      [2, "CONFIGURABLE_STRUCTURE", "MH-2"],
      [3, "CONFIGURABLE_STRUCTURE", "MH-10"],
      [4, "STOCK_PRODUCT", `${tag}-FC`],
    ]);

    for (const line of result.lineItems.slice(0, 3)) {
      const config = built.get(line.item)!;
      // Base plus wall per foot from the list (no boots in this catalog).
      const expected = BASE_PRICE + config.wallHeightFeet! * WALL_PER_FOOT;
      expect(config.totalPrice).toBeCloseTo(expected, 2);
      expect(Number(line.unitPrice)).toBeCloseTo(expected, 2);
      expect(line.qty).toBe("1");
      expect(line.structureConfig).toMatchObject({
        templateId,
        detailLevel: "DRILL_SHEET",
        wallHeightFeet: config.wallHeightFeet,
        rimElevation: config.rimElevation,
      });
      expect(line.statusNote).toBe("Drill sheet saved on the job.");
    }
    // The wall moved by hand comes through, so MH-2 is priced as built.
    expect(result.lineItems[1].structureConfig?.wallHeightAdjustInches).toBe(-6);

    expect(result.lineItems[3]).toMatchObject({
      qty: "3",
      unitPrice: String(CASTING_PRICE),
      productId: castingId,
      weight: "310",
    });
  });

  it("takes only the sheets it is given", async () => {
    const sheets = await loadSheetsForQuote(jobId);
    const mh2 = sheets.find((sheet) => sheet.structureNumber === "MH-2")!;
    const result = await loadQuoteLinesFromJobSheets(jobId, [mh2.id], priceListId);
    expect(result.lineItems.map((line) => [line.item, line.qty])).toEqual([
      ["MH-2", "1"],
      [`${tag}-FC`, "1"],
    ]);
  });

  it("prices a casting the list does not have at nothing, and says so", async () => {
    const other = await prisma.priceList.create({ data: { name: `${tag} Empty List` } });
    try {
      const result = await loadQuoteLinesFromJobSheets(jobId, null, other.id);
      expect(result.lineItems[3]).toMatchObject({ item: `${tag}-FC`, unitPrice: "0" });
      expect(result.unpriced).toContain(`${tag} Frame & Cover`);
    } finally {
      await prisma.priceList.delete({ where: { id: other.id } });
    }
  });

  it("leaves out a sheet one of the job's quotes already has, until that quote is dead", async () => {
    const quote = await createQuote(["MH-2"], "Q1");
    try {
      const summary = await summarizeSheetsForQuote(jobId);
      expect(summary.quotableCount).toBe(2);
      expect(summary.leftOut).toEqual([
        {
          structureNumber: "MH-2",
          quote: { id: quote.id, quoteNumber: quote.quoteNumber },
        },
      ]);
      const result = await loadQuoteLinesFromJobSheets(jobId, null, priceListId);
      expect(result.lineItems.map((line) => [line.item, line.qty])).toEqual([
        ["MH-1", "1"],
        ["MH-10", "1"],
        [`${tag}-FC`, "2"],
      ]);

      await prisma.quote.update({ where: { id: quote.id }, data: { status: "LOST" } });
      expect((await summarizeSheetsForQuote(jobId)).quotableCount).toBe(3);
    } finally {
      await prisma.quote.delete({ where: { id: quote.id } });
    }
  });
});

describe("Create Drill Sheets on a quote made from saved sheets", () => {
  it("links the sheets the job already has instead of making them again", async () => {
    const quote = await createQuote(["MH-1", "MH-2", "MH-10"], "Q2");
    const before = await prisma.jobStructure.findMany({
      where: { jobId },
      select: { id: true, structureNumber: true },
    });
    expect(before).toHaveLength(3);

    const result = await createDrillSheetsFromQuote(quote.id);
    expect(result).toEqual({ created: 0, linked: 3 });

    const after = await prisma.jobStructure.findMany({
      where: { jobId },
      select: { id: true, quoteId: true },
    });
    expect(after.map((structure) => structure.id).sort()).toEqual(
      before.map((structure) => structure.id).sort(),
    );
    expect(after.every((structure) => structure.quoteId === quote.id)).toBe(true);

    const lines = await prisma.quoteLineItem.findMany({
      where: { quoteId: quote.id },
      select: { itemCode: true, jobStructureId: true },
    });
    for (const line of lines) {
      const sheet = before.find(
        (structure) => structure.structureNumber?.toLowerCase() === line.itemCode,
      );
      expect(line.jobStructureId).toBe(sheet?.id);
    }

    // Pressing it again changes nothing, and every sheet now counts as quoted.
    expect(await createDrillSheetsFromQuote(quote.id)).toEqual({ created: 0, linked: 0 });
    const summary = await summarizeSheetsForQuote(jobId);
    expect(summary.quotableCount).toBe(0);
    expect(summary.leftOut).toHaveLength(3);
  });
});
