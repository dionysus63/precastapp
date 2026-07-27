"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type RectOpeningPayload = {
  /** Combined material/type description, e.g. "PVC SDR35". */
  pipeMaterial: string;
  pipeSizeInches: number;
  openingWidthInches: number;
  openingHeightInches: number;
  pipeWallThicknessInches: number;
  /** "" = no price entry on the selected list. */
  pricePerOpening: string;
};

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(String(value));
}

function parseRectOpeningsPayload(formData: FormData): RectOpeningPayload[] {
  const raw = String(formData.get("payload") ?? "").trim();
  if (!raw) {
    throw new Error("Missing rectangular opening data.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid rectangular opening data.");
  }

  const rows = Array.isArray(parsed) ? parsed : [];
  const result: RectOpeningPayload[] = [];

  for (const item of rows) {
    const row = item as Record<string, unknown>;
    const pipeMaterial = String(row.pipeMaterial ?? "").trim();
    const pipeSizeInches = Number(row.pipeSizeInches);
    const openingWidthInches = Number(row.openingWidthInches);
    const openingHeightInches = Number(row.openingHeightInches);

    if (
      !pipeMaterial ||
      !Number.isFinite(pipeSizeInches) ||
      pipeSizeInches <= 0 ||
      !Number.isFinite(openingWidthInches) ||
      openingWidthInches <= 0 ||
      !Number.isFinite(openingHeightInches) ||
      openingHeightInches <= 0
    ) {
      continue;
    }

    const wallRaw = Number(row.pipeWallThicknessInches);
    const pipeWallThicknessInches =
      Number.isFinite(wallRaw) && wallRaw > 0 ? wallRaw : 0;

    result.push({
      pipeMaterial,
      pipeSizeInches,
      openingWidthInches,
      openingHeightInches,
      pipeWallThicknessInches,
      pricePerOpening: String(row.pricePerOpening ?? "").trim(),
    });
  }

  return result;
}

export async function saveRectOpeningSizes(formData: FormData) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const priceListId = String(formData.get("priceListId") ?? "").trim();
  const entries = parseRectOpeningsPayload(formData);

  const keys = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.pipeMaterial.toLowerCase()}|${entry.pipeSizeInches}`;
    if (keys.has(key)) {
      throw new Error(
        `Duplicate entry for ${entry.pipeSizeInches}" ${entry.pipeMaterial}.`,
      );
    }
    keys.add(key);
  }

  const priceList = priceListId
    ? await prisma.priceList.findUnique({ where: { id: priceListId } })
    : null;
  if (!priceList) {
    throw new Error("Pick a price list before saving opening prices.");
  }

  // Upsert by material/size so catalog ids stay stable — price list entries
  // reference rows by id and must survive a settings save.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.rectOpeningSize.findMany();
    const existingByKey = new Map(
      existing.map((row) => [
        `${row.pipeMaterial.trim().toLowerCase()}|${Number(row.pipeSizeInches)}`,
        row,
      ]),
    );

    const keptIds = new Set<string>();
    for (const [index, entry] of entries.entries()) {
      const key = `${entry.pipeMaterial.toLowerCase()}|${entry.pipeSizeInches}`;
      const data = {
        pipeMaterial: entry.pipeMaterial,
        openingWidthInches: decimal(entry.openingWidthInches),
        openingHeightInches: decimal(entry.openingHeightInches),
        pipeWallThicknessInches: decimal(entry.pipeWallThicknessInches),
        sortOrder: index,
      };
      const current = existingByKey.get(key);
      const saved = current
        ? await tx.rectOpeningSize.update({ where: { id: current.id }, data })
        : await tx.rectOpeningSize.create({
            data: { ...data, pipeSizeInches: decimal(entry.pipeSizeInches) },
          });
      keptIds.add(saved.id);

      if (entry.pricePerOpening !== "") {
        const price = Number(entry.pricePerOpening);
        if (!Number.isFinite(price) || price < 0) {
          throw new Error(
            `Price per opening for ${entry.pipeSizeInches}" ${entry.pipeMaterial} must be a non-negative number (or blank).`,
          );
        }
        await tx.rectOpeningPriceListEntry.upsert({
          where: {
            priceListId_rectOpeningSizeId: {
              priceListId,
              rectOpeningSizeId: saved.id,
            },
          },
          create: {
            priceListId,
            rectOpeningSizeId: saved.id,
            pricePerOpening: decimal(price),
          },
          update: { pricePerOpening: decimal(price) },
        });
      } else {
        await tx.rectOpeningPriceListEntry.deleteMany({
          where: { priceListId, rectOpeningSizeId: saved.id },
        });
      }
    }

    await tx.rectOpeningSize.deleteMany({
      where: { id: { notIn: [...keptIds] } },
    });
  });

  revalidatePath("/structures");
  revalidatePath("/structures/rect-openings");
  redirect(
    `/structures/rect-openings?priceList=${encodeURIComponent(priceListId)}`,
  );
}
