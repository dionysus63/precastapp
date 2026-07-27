"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type DiameterConfigPayload = {
  label: string | null;
  insideDiameterFeet: number;
  wallThicknessInches: number | null;
  maxBaseHeightFeet: number;
  maxRiserHeightFeet: number;
  keyHeightFeet: number;
  /** "" = no price entry on the selected list (falls back to the default list). */
  wallPricePerFoot: string;
  basePrice: string;
};

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(String(value));
}

function parseDiameterConfigPayload(formData: FormData): DiameterConfigPayload[] {
  const raw = String(formData.get("payload") ?? "").trim();
  if (!raw) {
    throw new Error("Missing diameter config data.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid diameter config data.");
  }

  const rows = Array.isArray(parsed) ? parsed : [];
  const result: DiameterConfigPayload[] = [];

  for (const item of rows) {
    const row = item as Record<string, unknown>;
    const label = String(row.label ?? "").trim() || null;
    const insideDiameterFeet = Number(row.insideDiameterFeet);
    const wallRaw = String(row.wallThicknessInches ?? "").trim();
    const wallThicknessInches = wallRaw === "" ? null : Number(wallRaw);
    const maxBaseHeightFeet = Number(row.maxBaseHeightFeet);
    const maxRiserHeightFeet = Number(row.maxRiserHeightFeet);
    const keyHeightFeet = Number(row.keyHeightFeet);

    if (
      !Number.isFinite(insideDiameterFeet) ||
      insideDiameterFeet <= 0 ||
      !Number.isFinite(maxBaseHeightFeet) ||
      maxBaseHeightFeet <= 0 ||
      !Number.isFinite(maxRiserHeightFeet) ||
      maxRiserHeightFeet <= 0 ||
      !Number.isFinite(keyHeightFeet) ||
      keyHeightFeet < 0
    ) {
      continue;
    }

    if (
      wallThicknessInches != null &&
      (!Number.isFinite(wallThicknessInches) || wallThicknessInches <= 0)
    ) {
      throw new Error(
        `Wall thickness for ${insideDiameterFeet}' must be a positive number of inches (or blank).`,
      );
    }

    result.push({
      label,
      insideDiameterFeet,
      wallThicknessInches,
      maxBaseHeightFeet,
      maxRiserHeightFeet,
      keyHeightFeet,
      wallPricePerFoot: String(row.wallPricePerFoot ?? "").trim(),
      basePrice: String(row.basePrice ?? "").trim(),
    });
  }

  return result;
}

function parsePrice(raw: string, label: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number (or blank).`);
  }
  return value;
}

export async function saveStructureDiameterConfigs(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const priceListId = String(formData.get("priceListId") ?? "").trim();
  const entries = parseDiameterConfigPayload(formData);

  const keys = new Set<number>();
  for (const entry of entries) {
    if (keys.has(entry.insideDiameterFeet)) {
      throw new Error(`Duplicate diameter ${entry.insideDiameterFeet}'.`);
    }
    keys.add(entry.insideDiameterFeet);
  }

  const priceList = priceListId
    ? await prisma.priceList.findUnique({ where: { id: priceListId } })
    : null;
  if (!priceList) {
    throw new Error("Pick a price list before saving mold prices.");
  }

  // Upsert by inside diameter so config ids stay stable — price list entries
  // (and anything else referencing a mold) survive a settings save.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.structureDiameterConfig.findMany();
    const existingByDiameter = new Map(
      existing.map((config) => [Number(config.insideDiameterFeet), config]),
    );

    const keptIds = new Set<string>();
    for (const [index, entry] of entries.entries()) {
      const geometry = {
        label: entry.label,
        wallThicknessInches:
          entry.wallThicknessInches != null
            ? decimal(entry.wallThicknessInches)
            : null,
        maxBaseHeightFeet: decimal(entry.maxBaseHeightFeet),
        maxRiserHeightFeet: decimal(entry.maxRiserHeightFeet),
        keyHeightFeet: decimal(entry.keyHeightFeet),
        sortOrder: index,
      };
      const current = existingByDiameter.get(entry.insideDiameterFeet);
      const config = current
        ? await tx.structureDiameterConfig.update({
            where: { id: current.id },
            data: geometry,
          })
        : await tx.structureDiameterConfig.create({
            data: {
              ...geometry,
              insideDiameterFeet: decimal(entry.insideDiameterFeet),
            },
          });
      keptIds.add(config.id);

      const hasPrice =
        entry.wallPricePerFoot !== "" || entry.basePrice !== "";
      if (hasPrice) {
        const wallPricePerFoot = parsePrice(
          entry.wallPricePerFoot || "0",
          `Wall $/ft for ${entry.insideDiameterFeet}'`,
        );
        const basePrice = parsePrice(
          entry.basePrice || "0",
          `Base price for ${entry.insideDiameterFeet}'`,
        );
        await tx.diameterPriceListEntry.upsert({
          where: {
            priceListId_diameterConfigId: {
              priceListId,
              diameterConfigId: config.id,
            },
          },
          create: {
            priceListId,
            diameterConfigId: config.id,
            wallPricePerFoot: decimal(wallPricePerFoot),
            basePrice: decimal(basePrice),
          },
          update: {
            wallPricePerFoot: decimal(wallPricePerFoot),
            basePrice: decimal(basePrice),
          },
        });
      } else {
        await tx.diameterPriceListEntry.deleteMany({
          where: { priceListId, diameterConfigId: config.id },
        });
      }
    }

    // Molds removed from the grid go away entirely (their entries cascade).
    await tx.structureDiameterConfig.deleteMany({
      where: { id: { notIn: [...keptIds] } },
    });
  });

  revalidatePath("/settings");
  revalidatePath("/settings/diameters");
  redirect(
    `/settings/diameters?success=1&priceList=${encodeURIComponent(priceListId)}`,
  );
}
