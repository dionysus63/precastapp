"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { returnActionError } from "@/lib/server/action-errors";

type PipeOpeningPayload = {
  /** Existing catalog row id, so a material rename keeps the row (and its prices). */
  id: string | null;
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
      id: String(row.id ?? "").trim() || null,
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

/** Errors come back as `{ error }` (see returnActionError). */
export async function savePipeOpeningSizes(formData: FormData) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  return returnActionError(() => savePipeOpeningSizesOrThrow(formData));
}

async function savePipeOpeningSizesOrThrow(formData: FormData) {
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

  // Upsert by id, then by material/size/boot, so catalog ids stay stable —
  // price list entries reference rows by id and must survive a settings save
  // (including a material rename).
  await prisma.$transaction(async (tx) => {
    const existing = await tx.pipeOpeningSize.findMany();
    const existingById = new Map(existing.map((row) => [row.id, row]));
    const existingByKey = new Map(
      existing.map((row) => [
        `${combinedMaterial(row)}|${Number(row.pipeSizeInches)}|${row.hasBoot}`,
        row,
      ]),
    );

    const claimed = new Set<string>();
    const matches = entries.map((entry) => {
      const key = `${entry.pipeMaterial.toLowerCase()}|${entry.pipeSizeInches}|${entry.hasBoot}`;
      const byId = entry.id ? existingById.get(entry.id) : undefined;
      const match =
        byId && !claimed.has(byId.id) ? byId : existingByKey.get(key);
      if (!match || claimed.has(match.id)) {
        return null;
      }
      claimed.add(match.id);
      return match;
    });

    // Remove dropped rows first so a renamed row can take over their key.
    await tx.pipeOpeningSize.deleteMany({
      where: { id: { notIn: [...claimed] } },
    });

    for (const [index, entry] of entries.entries()) {
      const data = {
        pipeMaterial: entry.pipeMaterial,
        // Material and type are captured as one combined string now.
        pipeType: "",
        hasBoot: entry.hasBoot,
        holeDiameterInches: decimal(entry.holeDiameterInches),
        pipeWallThicknessInches: decimal(entry.pipeWallThicknessInches),
        bootModel: entry.bootModel,
        pipeSizeInches: decimal(entry.pipeSizeInches),
        sortOrder: index,
      };
      const current = matches[index];
      const saved = current
        ? await tx.pipeOpeningSize.update({
            where: { id: current.id },
            data,
          })
        : await tx.pipeOpeningSize.create({ data });

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
  });

  revalidatePath("/structures");
  revalidatePath("/structures/pipe-openings");
  redirect(
    `/structures/pipe-openings?priceList=${encodeURIComponent(priceListId)}`,
  );
}
