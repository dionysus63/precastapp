import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("server-only", () => ({}));

import { savePipeOpeningSizes } from "@/app/structures/pipe-openings/actions";
import { saveRectOpeningSizes } from "@/app/structures/rect-openings/actions";
import { prisma } from "@/lib/prisma";

const tag = `CATALOG-${Date.now()}`;
let priceListId: string;
let otherPriceListId: string;

/** The save replaces the whole catalog, so carry existing rows through untouched. */
async function existingPipePayload() {
  const rows = await prisma.pipeOpeningSize.findMany({
    where: { NOT: { pipeMaterial: { startsWith: tag } } },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    pipeMaterial: [row.pipeMaterial, row.pipeType].filter(Boolean).join(" "),
    pipeSizeInches: String(row.pipeSizeInches),
    hasBoot: row.hasBoot,
    holeDiameterInches: String(row.holeDiameterInches),
    pipeWallThicknessInches: String(row.pipeWallThicknessInches),
    bootModel: row.bootModel,
    pricePerBoot: null,
  }));
}

async function existingRectPayload() {
  const rows = await prisma.rectOpeningSize.findMany({
    where: { NOT: { pipeMaterial: { startsWith: tag } } },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    pipeMaterial: row.pipeMaterial,
    pipeSizeInches: String(row.pipeSizeInches),
    openingWidthInches: String(row.openingWidthInches),
    openingHeightInches: String(row.openingHeightInches),
    pipeWallThicknessInches: String(row.pipeWallThicknessInches),
    pricePerOpening: null,
  }));
}

function form(payload: unknown[], listId = priceListId) {
  const data = new FormData();
  data.set("payload", JSON.stringify(payload));
  data.set("priceListId", listId);
  return data;
}

beforeAll(async () => {
  priceListId = (await prisma.priceList.create({ data: { name: `${tag} A` } }))
    .id;
  otherPriceListId = (
    await prisma.priceList.create({ data: { name: `${tag} B` } })
  ).id;
});

afterAll(async () => {
  await prisma.pipeOpeningSize.deleteMany({
    where: { pipeMaterial: { startsWith: tag } },
  });
  await prisma.rectOpeningSize.deleteMany({
    where: { pipeMaterial: { startsWith: tag } },
  });
  await prisma.priceList.deleteMany({
    where: { id: { in: [priceListId, otherPriceListId] } },
  });
});

describe("round opening catalog save", () => {
  it("keeps row ids and other price lists' prices when a material is renamed", async () => {
    const keep = await existingPipePayload();
    const material = `${tag} PVC`;
    await savePipeOpeningSizes(
      form([
        ...keep,
        {
          pipeMaterial: material,
          pipeSizeInches: "8",
          hasBoot: true,
          holeDiameterInches: "12",
          pipeWallThicknessInches: "0.24",
          bootModel: "106-008",
          pricePerBoot: "45",
        },
        {
          pipeMaterial: material,
          pipeSizeInches: "8",
          hasBoot: false,
          holeDiameterInches: "14",
          pipeWallThicknessInches: "0.24",
          bootModel: null,
          pricePerBoot: null,
        },
      ]),
    );
    const saved = await prisma.pipeOpeningSize.findMany({
      where: { pipeMaterial: material },
      orderBy: { hasBoot: "desc" },
    });
    expect(saved).toHaveLength(2);
    const [boot, noBoot] = saved;
    await prisma.pipeOpeningPriceListEntry.create({
      data: {
        priceListId: otherPriceListId,
        pipeOpeningSizeId: boot.id,
        pricePerBoot: 50,
      },
    });

    // Rename the material and switch No Boot off: the boot row keeps its id.
    const renamed = `${tag} PVC SDR35`;
    await savePipeOpeningSizes(
      form([
        ...keep,
        {
          id: boot.id,
          pipeMaterial: renamed,
          pipeSizeInches: "8",
          hasBoot: true,
          holeDiameterInches: "12",
          pipeWallThicknessInches: "0.24",
          bootModel: "106-008",
          pricePerBoot: "45",
        },
      ]),
    );

    const after = await prisma.pipeOpeningSize.findMany({
      where: { pipeMaterial: { startsWith: tag } },
      include: { priceEntries: true },
    });
    expect(after.map((row) => [row.id, row.pipeMaterial])).toEqual([
      [boot.id, renamed],
    ]);
    expect(
      after[0].priceEntries
        .map((entry) => [entry.priceListId, Number(entry.pricePerBoot)])
        .sort(),
    ).toEqual(
      [
        [priceListId, 45],
        [otherPriceListId, 50],
      ].sort(),
    );
    expect(
      await prisma.pipeOpeningSize.findUnique({ where: { id: noBoot.id } }),
    ).toBeNull();
    // Rows outside this test survive the save.
    expect(await prisma.pipeOpeningSize.count()).toBe(keep.length + 1);
  });
});

describe("rect opening catalog save", () => {
  it("keeps row ids across a material rename", async () => {
    const keep = await existingRectPayload();
    const material = `${tag} RCP`;
    const line = {
      pipeSizeInches: "24",
      openingWidthInches: "34",
      openingHeightInches: "34",
      pipeWallThicknessInches: "3",
      pricePerOpening: "55",
    };
    await saveRectOpeningSizes(
      form([...keep, { ...line, pipeMaterial: material }]),
    );
    const saved = await prisma.rectOpeningSize.findFirstOrThrow({
      where: { pipeMaterial: material },
    });

    const renamed = `${tag} RCP Class III`;
    await saveRectOpeningSizes(
      form([...keep, { ...line, id: saved.id, pipeMaterial: renamed }]),
    );
    const after = await prisma.rectOpeningSize.findMany({
      where: { pipeMaterial: { startsWith: tag } },
      include: { priceEntries: true },
    });
    expect(after.map((row) => [row.id, row.pipeMaterial])).toEqual([
      [saved.id, renamed],
    ]);
    expect(after[0].priceEntries.map((e) => Number(e.pricePerOpening))).toEqual(
      [55],
    );
  });
});
