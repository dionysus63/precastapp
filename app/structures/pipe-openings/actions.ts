"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type PipeOpeningPayload = {
  /** Combined material/type description, e.g. "PVC SDR35". */
  pipeMaterial: string;
  pipeSizeInches: number;
  hasBoot: boolean;
  holeDiameterInches: number;
  pipeWallThicknessInches: number;
  bootModel: string | null;
  /** "" = no price entry on the selected list. */
  pricePerBoot: string;
};

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(String(value));
}

function parsePipeOpeningsPayload(formData: FormData): PipeOpeningPayload[] {
  const raw = String(formData.get("payload") ?? "").trim();
  if (!raw) {
    throw new Error("Missing pipe opening data.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid pipe opening data.");
  }

  const rows = Array.isArray(parsed) ? parsed : [];
  const result: PipeOpeningPayload[] = [];

  for (const item of rows) {
    const row = item as Record<string, unknown>;
    const pipeMaterial = String(row.pipeMaterial ?? "").trim();
    const pipeSizeInches = Number(row.pipeSizeInches);
    const holeDiameterInches = Number(row.holeDiameterInches);

    if (
      !pipeMaterial ||
      !Number.isFinite(pipeSizeInches) ||
      pipeSizeInches <= 0 ||
      !Number.isFinite(holeDiameterInches) ||
      holeDiameterInches <= 0
    ) {
      continue;
    }

    const wallRaw = Number(row.pipeWallThicknessInches);
    const pipeWallThicknessInches =
      Number.isFinite(wallRaw) && wallRaw > 0 ? wallRaw : 0;

    result.push({
      pipeMaterial,
      pipeSizeInches,
      hasBoot: row.hasBoot !== false,
      holeDiameterInches,
      pipeWallThicknessInches,
      bootModel: String(row.bootModel ?? "").trim() || null,
      pricePerBoot: String(row.pricePerBoot ?? "").trim(),
    });
  }

  return result;
}

/** Legacy rows keep material and type split; match on the combined string. */
function combinedMaterial(row: { pipeMaterial: string; pipeType: string }) {
  return [row.pipeMaterial, row.pipeType]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export async function savePipeOpeningSizes(formData: FormData) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const priceListId = String(formData.get("priceListId") ?? "").trim();
  const entries = parsePipeOpeningsPayload(formData);

  const keys = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.pipeMaterial.toLowerCase()}|${entry.pipeSizeInches}|${entry.hasBoot}`;
    if (keys.has(key)) {
      throw new Error(
        `Duplicate entry for ${entry.pipeSizeInches}" ${entry.pipeMaterial} (${entry.hasBoot ? "boot" : "no boot"}).`,
      );
    }
    keys.add(key);
  }

  const priceList = priceListId
    ? await prisma.priceList.findUnique({ where: { id: priceListId } })
    : null;
  if (!priceList) {
    throw new Error("Pick a price list before saving boot prices.");
  }

  // Upsert by material/size/boot so catalog ids stay stable — price list
  // entries reference rows by id and must survive a settings save.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.pipeOpeningSize.findMany();
    const existingByKey = new Map(
      existing.map((row) => [
        `${combinedMaterial(row)}|${Number(row.pipeSizeInches)}|${row.hasBoot}`,
        row,
      ]),
    );

    const keptIds = new Set<string>();
    for (const [index, entry] of entries.entries()) {
      const key = `${entry.pipeMaterial.toLowerCase()}|${entry.pipeSizeInches}|${entry.hasBoot}`;
      const data = {
        pipeMaterial: entry.pipeMaterial,
        // Material and type are captured as one combined string now.
        pipeType: "",
        hasBoot: entry.hasBoot,
        holeDiameterInches: decimal(entry.holeDiameterInches),
        pipeWallThicknessInches: decimal(entry.pipeWallThicknessInches),
        bootModel: entry.bootModel,
        sortOrder: index,
      };
      const current = existingByKey.get(key);
      const saved = current
        ? await tx.pipeOpeningSize.update({
            where: { id: current.id },
            data,
          })
        : await tx.pipeOpeningSize.create({
            data: { ...data, pipeSizeInches: decimal(entry.pipeSizeInches) },
          });
      keptIds.add(saved.id);

      if (entry.pricePerBoot !== "") {
        const price = Number(entry.pricePerBoot);
        if (!Number.isFinite(price) || price < 0) {
          throw new Error(
            `Price per boot for ${entry.pipeSizeInches}" ${entry.pipeMaterial} must be a non-negative number (or blank).`,
          );
        }
        await tx.pipeOpeningPriceListEntry.upsert({
          where: {
            priceListId_pipeOpeningSizeId: {
              priceListId,
              pipeOpeningSizeId: saved.id,
            },
          },
          create: {
            priceListId,
            pipeOpeningSizeId: saved.id,
            pricePerBoot: decimal(price),
          },
          update: { pricePerBoot: decimal(price) },
        });
      } else {
        await tx.pipeOpeningPriceListEntry.deleteMany({
          where: { priceListId, pipeOpeningSizeId: saved.id },
        });
      }
    }

    await tx.pipeOpeningSize.deleteMany({
      where: { id: { notIn: [...keptIds] } },
    });
  });

  revalidatePath("/structures");
  revalidatePath("/structures/pipe-openings");
  redirect(
    `/structures/pipe-openings?priceList=${encodeURIComponent(priceListId)}`,
  );
}
