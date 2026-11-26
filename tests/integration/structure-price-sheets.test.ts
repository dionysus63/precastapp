import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
}));
vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));

import { saveStructurePrices } from "@/app/pricing/actions";
import { requirePermission } from "@/lib/auth/session";
import { getDefaultPriceListId } from "@/lib/price-list-service";
import { prisma } from "@/lib/prisma";
import {
  copyRingPrices,
  loadStructurePriceTables,
} from "@/lib/pricing/structure-price-data";
import type {
  StructurePriceRow,
  StructurePriceTableKey,
} from "@/lib/pricing/structure-price-tables";
import {
  getRingDefaultPricePerFoot,
  parseRingBuilderConfig,
} from "@/lib/ring-builder-settings";
import { loadStructurePricing } from "@/lib/structure-pricing";

/**
 * Step 4 of the pricing rework: the Structures tab of the Pricing screen
 * reads and writes the structure prices of one price list, where they always
 * lived, with the default list's numbers as what a row falls back on.
 */
const tag = `STRUCTPRICE-${Date.now()}`;
// An inside diameter no other test uses (the column is unique).
const DIAMETER = 91.37;
const RING = "10:DRAIN";

let defaultListId: string;
let createdDefaultList = false;
let listId: string;
let copyListId: string;
let moldId: string;
let templateId: string;
let bootId: string;
let rectOpeningId: string;
let originalRingConfig: unknown;

async function rowOf(
  table: StructurePriceTableKey,
  rowId: string,
  priceListId = listId,
): Promise<StructurePriceRow> {
  const tables = await loadStructurePriceTables(priceListId);
  const row = tables[table].find((entry) => entry.id === rowId);
  if (!row) {
    throw new Error(`No ${table} row ${rowId}`);
  }
  return row;
}

async function save(
  table: StructurePriceTableKey,
  rowId: string,
  values: Record<string, string | null>,
  priceListId = listId,
) {
  return saveStructurePrices(priceListId, table, [{ rowId, values }]);
}

async function ringConfig() {
  const settings = await prisma.appSettings.findUniqueOrThrow({ where: { id: "default" } });
  return parseRingBuilderConfig(settings.ringBuilderConfig);
}

beforeAll(async () => {
  const existingDefault = await getDefaultPriceListId();
  if (existingDefault) {
    defaultListId = existingDefault;
  } else {
    defaultListId = (
      await prisma.priceList.create({ data: { name: `${tag} default`, isDefault: true } })
    ).id;
    createdDefaultList = true;
  }
  listId = (await prisma.priceList.create({ data: { name: `${tag} list` } })).id;
  copyListId = (await prisma.priceList.create({ data: { name: `${tag} copy` } })).id;

  moldId = (
    await prisma.structureDiameterConfig.create({
      data: {
        label: `${tag} mold`,
        insideDiameterFeet: DIAMETER,
        wallThicknessInches: 8,
        maxBaseHeightFeet: 4,
        maxRiserHeightFeet: 4,
        keyHeightFeet: 0.33,
        priceEntries: {
          create: { priceListId: defaultListId, wallPricePerFoot: 185, basePrice: 620 },
        },
      },
    })
  ).id;
  // A rectangular template with a base slab and no top slab.
  templateId = (
    await prisma.structureTemplate.create({
      data: {
        name: `${tag} catch basin`,
        shape: "RECTANGULAR",
        topSlabThicknessInches: 0,
        baseSlabThicknessInches: 8,
      },
    })
  ).id;
  bootId = (
    await prisma.pipeOpeningSize.create({
      data: {
        pipeMaterial: `${tag} PVC`,
        pipeSizeInches: 12,
        pipeType: "",
        hasBoot: true,
        holeDiameterInches: 16,
        bootModel: "S106",
        priceEntries: { create: { priceListId: defaultListId, pricePerBoot: 95 } },
      },
    })
  ).id;
  rectOpeningId = (
    await prisma.rectOpeningSize.create({
      data: {
        pipeMaterial: `${tag} RCP`,
        pipeSizeInches: 18,
        openingWidthInches: 26,
        openingHeightInches: 26,
      },
    })
  ).id;

  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  originalRingConfig = settings?.ringBuilderConfig ?? null;
});

afterAll(async () => {
  if (originalRingConfig != null) {
    await prisma.appSettings.update({
      where: { id: "default" },
      data: { ringBuilderConfig: originalRingConfig as never },
    });
  }
  await prisma.structureDiameterConfig.deleteMany({ where: { id: moldId } });
  await prisma.structureTemplate.deleteMany({ where: { id: templateId } });
  await prisma.pipeOpeningSize.deleteMany({ where: { id: bootId } });
  await prisma.rectOpeningSize.deleteMany({ where: { id: rectOpeningId } });
  await prisma.priceList.deleteMany({
    where: { id: { in: [listId, copyListId, ...(createdDefaultList ? [defaultListId] : [])] } },
  });
  await prisma.$disconnect();
});

describe("reading the structure price sheets", () => {
  it("shows a list with no numbers of its own what it falls back on", async () => {
    expect(await rowOf("molds", moldId)).toMatchObject({
      label: `${tag} mold`,
      detail: "91.37' inside diameter",
      values: { wallPricePerFoot: null, basePrice: null },
      inherited: { wallPricePerFoot: "185.00", basePrice: "620.00" },
    });
    expect(await rowOf("boots", bootId)).toMatchObject({
      label: `12" ${tag} PVC`,
      detail: "Boot S106",
      values: { pricePerBoot: null },
      inherited: { pricePerBoot: "95.00" },
    });
  });

  it("shows the default list its own numbers and nothing to fall back on", async () => {
    expect(await rowOf("molds", moldId, defaultListId)).toMatchObject({
      values: { wallPricePerFoot: "185.00", basePrice: "620.00" },
      inherited: null,
    });
  });

  it("marks the slab a template does not have", async () => {
    expect(await rowOf("rectTemplates", templateId)).toMatchObject({
      label: `${tag} catch basin`,
      disabledColumns: ["topSlabPrice"],
      inherited: null,
    });
    expect(await rowOf("rectOpenings", rectOpeningId)).toMatchObject({
      label: `18" ${tag} RCP`,
      detail: '26" x 26" opening',
    });
  });
});

describe("saving a mold's prices", () => {
  it("gives the list its own row, keeping the price that was not typed", async () => {
    const result = await save("molds", moldId, { wallPricePerFoot: "200", basePrice: "" });
    expect(result).toMatchObject({
      rows: [{ id: moldId, values: { wallPricePerFoot: "200.00", basePrice: "620.00" } }],
    });
    // The drill sheet prices off the same row.
    const pricing = await loadStructurePricing(listId);
    expect(pricing.diameters.get(moldId)).toEqual({
      wallPricePerFoot: 200,
      basePrice: 620,
      usedFallback: false,
    });
    // The default list is untouched.
    expect(await rowOf("molds", moldId, defaultListId)).toMatchObject({
      values: { wallPricePerFoot: "185.00", basePrice: "620.00" },
    });
  });

  it("puts the row back on the default list when its prices are cleared", async () => {
    await save("molds", moldId, { wallPricePerFoot: "", basePrice: "" });
    expect(
      await prisma.diameterPriceListEntry.count({
        where: { priceListId: listId, diameterConfigId: moldId },
      }),
    ).toBe(0);
    const pricing = await loadStructurePricing(listId);
    expect(pricing.diameters.get(moldId)).toMatchObject({
      wallPricePerFoot: 185,
      usedFallback: true,
    });
  });

  it("takes the permission of the mold settings screen", async () => {
    vi.mocked(requirePermission).mockClear();
    await save("molds", moldId, { wallPricePerFoot: "", basePrice: "" });
    expect(requirePermission).toHaveBeenCalledWith("SETTINGS_MANAGE");
  });

  it("says which price it could not read and saves nothing", async () => {
    const result = await save("molds", moldId, { wallPricePerFoot: "abc", basePrice: "10" });
    expect(result).toEqual({
      error: `${tag} mold: Wall per Foot: Type a price such as 1450 or 618.50.`,
    });
    expect(
      await prisma.diameterPriceListEntry.count({
        where: { priceListId: listId, diameterConfigId: moldId },
      }),
    ).toBe(0);
  });
});

describe("saving a rectangular template's prices", () => {
  it("saves the list's prices and the template's minimum feet billed", async () => {
    vi.mocked(requirePermission).mockClear();
    const result = await save("rectTemplates", templateId, {
      wallPricePerFoot: "165",
      minPricingHeightFeet: "4",
      topSlabPrice: "999",
      baseSlabPrice: "690",
    });
    expect(requirePermission).toHaveBeenCalledWith("STRUCTURES_MANAGE");
    expect(result).toMatchObject({
      rows: [
        {
          values: {
            wallPricePerFoot: "165.00",
            minPricingHeightFeet: "4.00",
            // No top slab on this template, so no top slab price.
            topSlabPrice: "0.00",
            baseSlabPrice: "690.00",
          },
        },
      ],
    });
    const template = await prisma.structureTemplate.findUniqueOrThrow({
      where: { id: templateId },
    });
    expect(Number(template.rectMinPricingHeightFeet)).toBe(4);
  });

  it("keeps the minimum when the list's prices are cleared", async () => {
    await save("rectTemplates", templateId, {
      wallPricePerFoot: "",
      minPricingHeightFeet: "4",
      baseSlabPrice: "",
    });
    expect(await rowOf("rectTemplates", templateId)).toMatchObject({
      values: {
        wallPricePerFoot: null,
        baseSlabPrice: null,
        minPricingHeightFeet: "4.00",
      },
    });
  });
});

describe("saving opening prices", () => {
  it("saves a boot price on the list", async () => {
    await save("boots", bootId, { pricePerBoot: "118.5" });
    const pricing = await loadStructurePricing(listId);
    expect(pricing.pipeOpenings.get(bootId)).toEqual({ price: 118.5, usedFallback: false });
  });

  it("saves and clears a rectangular opening price", async () => {
    await save("rectOpenings", rectOpeningId, { pricePerOpening: "75" });
    expect(await rowOf("rectOpenings", rectOpeningId)).toMatchObject({
      values: { pricePerOpening: "75.00" },
    });
    await save("rectOpenings", rectOpeningId, { pricePerOpening: "" });
    expect(await rowOf("rectOpenings", rectOpeningId)).toMatchObject({
      values: { pricePerOpening: null },
      inherited: null,
    });
  });
});

describe("saving several rows at once", () => {
  it("saves none of a pasted block when one row cannot be read", async () => {
    const result = await saveStructurePrices(listId, "boots", [
      { rowId: bootId, values: { pricePerBoot: "130" } },
      { rowId: "no-such-row", values: { pricePerBoot: "140" } },
    ]);
    expect(result).toEqual({
      error: "A row on this screen no longer exists. Reload the page and try again.",
    });
    expect(await rowOf("boots", bootId)).toMatchObject({
      values: { pricePerBoot: "118.50" },
    });
  });

  it("turns down a sheet that does not exist", async () => {
    expect(await saveStructurePrices(listId, "castings", [])).toEqual({
      error: "That price sheet does not exist.",
    });
  });
});

describe("ring prices per foot", () => {
  it("saves a ring's price on the list and leaves the ring builder settings alone", async () => {
    const before = await ringConfig();
    const result = await save("rings", RING, { pricePerFoot: "131" });
    expect(result).toMatchObject({
      rows: [{ id: RING, label: "10' Drain", values: { pricePerFoot: "131.00" } }],
    });
    const after = await ringConfig();
    expect(getRingDefaultPricePerFoot(after, 10, "DRAIN", listId)).toBe(131);
    // Another list still gets the ring's standard price.
    expect(getRingDefaultPricePerFoot(after, 10, "DRAIN", "another-list")).toBe(
      getRingDefaultPricePerFoot(before, 10, "DRAIN", "another-list"),
    );
    for (const mapping of before) {
      const kept = after.find(
        (entry) =>
          entry.diameterFeet === mapping.diameterFeet && entry.style === mapping.style,
      );
      expect(kept?.otherSubcategories).toEqual(mapping.otherSubcategories);
      expect(kept?.defaultPricePerFoot).toBe(mapping.defaultPricePerFoot);
    }
  });

  it("copies ring prices onto a copied price list", async () => {
    expect(await copyRingPrices(copyListId, listId)).toBe(true);
    expect(getRingDefaultPricePerFoot(await ringConfig(), 10, "DRAIN", copyListId)).toBe(131);
    // A list with no ring prices of its own has nothing to copy.
    expect(await copyRingPrices(copyListId, "list-with-no-ring-prices")).toBe(false);
  });

  it("puts a ring back on its standard price when the box is cleared", async () => {
    await save("rings", RING, { pricePerFoot: "" });
    const config = await ringConfig();
    const mapping = config.find(
      (entry) => entry.diameterFeet === 10 && entry.style === "DRAIN",
    );
    expect(mapping?.pricePerFootByPriceList[listId]).toBeUndefined();
    expect(await rowOf("rings", RING)).toMatchObject({ values: { pricePerFoot: null } });
  });
});
