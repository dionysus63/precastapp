"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type DiameterConfigPayload = {
  insideDiameterFeet: number;
  maxBaseHeightFeet: number;
  maxRiserHeightFeet: number;
  keyHeightFeet: number;
  wallPricePerFoot: number;
  basePrice: number;
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
    const insideDiameterFeet = Number(row.insideDiameterFeet);
    const maxBaseHeightFeet = Number(row.maxBaseHeightFeet);
    const maxRiserHeightFeet = Number(row.maxRiserHeightFeet);
    const keyHeightFeet = Number(row.keyHeightFeet);
    const wallPricePerFoot = Number(row.wallPricePerFoot ?? 0);
    const basePrice = Number(row.basePrice ?? 0);

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

    result.push({
      insideDiameterFeet,
      maxBaseHeightFeet,
      maxRiserHeightFeet,
      keyHeightFeet,
      wallPricePerFoot: Number.isFinite(wallPricePerFoot) ? wallPricePerFoot : 0,
      basePrice: Number.isFinite(basePrice) ? basePrice : 0,
    });
  }

  return result;
}

export async function saveStructureDiameterConfigs(formData: FormData) {
  await requirePermission(AppPermission.SETTINGS_MANAGE);
  const entries = parseDiameterConfigPayload(formData);

  const keys = new Set<number>();
  for (const entry of entries) {
    if (keys.has(entry.insideDiameterFeet)) {
      throw new Error(`Duplicate diameter ${entry.insideDiameterFeet}'.`);
    }
    keys.add(entry.insideDiameterFeet);
  }

  await prisma.$transaction(async (tx) => {
    await tx.structureDiameterConfig.deleteMany({});
    if (entries.length > 0) {
      await tx.structureDiameterConfig.createMany({
        data: entries.map((entry, index) => ({
          insideDiameterFeet: decimal(entry.insideDiameterFeet),
          maxBaseHeightFeet: decimal(entry.maxBaseHeightFeet),
          maxRiserHeightFeet: decimal(entry.maxRiserHeightFeet),
          keyHeightFeet: decimal(entry.keyHeightFeet),
          wallPricePerFoot: decimal(entry.wallPricePerFoot),
          basePrice: decimal(entry.basePrice),
          sortOrder: index,
        })),
      });
    }
  });

  revalidatePath("/settings");
  revalidatePath("/settings/diameters");
  redirect("/settings/diameters?success=1");
}
