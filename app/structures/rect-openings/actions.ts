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
  pricePerOpening: number | null;
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

    const priceRaw = row.pricePerOpening;
    const pricePerOpening =
      priceRaw === null || priceRaw === undefined || priceRaw === ""
        ? null
        : Number(priceRaw);

    result.push({
      pipeMaterial,
      pipeSizeInches,
      openingWidthInches,
      openingHeightInches,
      pricePerOpening:
        pricePerOpening != null && Number.isFinite(pricePerOpening)
          ? pricePerOpening
          : null,
    });
  }

  return result;
}

export async function saveRectOpeningSizes(formData: FormData) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
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

  await prisma.$transaction(async (tx) => {
    await tx.rectOpeningSize.deleteMany({});
    if (entries.length > 0) {
      await tx.rectOpeningSize.createMany({
        data: entries.map((entry, index) => ({
          pipeMaterial: entry.pipeMaterial,
          pipeSizeInches: decimal(entry.pipeSizeInches),
          openingWidthInches: decimal(entry.openingWidthInches),
          openingHeightInches: decimal(entry.openingHeightInches),
          pricePerOpening:
            entry.pricePerOpening === null
              ? null
              : decimal(entry.pricePerOpening),
          sortOrder: index,
        })),
      });
    }
  });

  revalidatePath("/structures");
  revalidatePath("/structures/rect-openings");
  redirect("/structures/rect-openings");
}
