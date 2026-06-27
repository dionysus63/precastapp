"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type PipeOpeningPayload = {
  pipeMaterial: string;
  pipeSizeInches: number;
  pipeType: string;
  holeDiameterInches: number;
  bootModel: string | null;
  pricePerBoot: number | null;
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
    const pipeType = String(row.pipeType ?? "").trim();
    const pipeSizeInches = Number(row.pipeSizeInches);
    const holeDiameterInches = Number(row.holeDiameterInches);

    if (
      !pipeMaterial ||
      !pipeType ||
      !Number.isFinite(pipeSizeInches) ||
      pipeSizeInches <= 0 ||
      !Number.isFinite(holeDiameterInches) ||
      holeDiameterInches <= 0
    ) {
      continue;
    }

    const priceRaw = row.pricePerBoot;
    const pricePerBoot =
      priceRaw === null || priceRaw === undefined || priceRaw === ""
        ? null
        : Number(priceRaw);

    result.push({
      pipeMaterial,
      pipeSizeInches,
      pipeType,
      holeDiameterInches,
      bootModel: String(row.bootModel ?? "").trim() || null,
      pricePerBoot:
        pricePerBoot != null && Number.isFinite(pricePerBoot)
          ? pricePerBoot
          : null,
    });
  }

  return result;
}

export async function savePipeOpeningSizes(formData: FormData) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const entries = parsePipeOpeningsPayload(formData);

  const keys = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.pipeMaterial}|${entry.pipeSizeInches}|${entry.pipeType}`;
    if (keys.has(key)) {
      throw new Error(
        `Duplicate entry for ${entry.pipeMaterial} ${entry.pipeSizeInches}" ${entry.pipeType}.`,
      );
    }
    keys.add(key);
  }

  await prisma.$transaction(async (tx) => {
    await tx.pipeOpeningSize.deleteMany({});
    if (entries.length > 0) {
      await tx.pipeOpeningSize.createMany({
        data: entries.map((entry, index) => ({
          pipeMaterial: entry.pipeMaterial,
          pipeSizeInches: decimal(entry.pipeSizeInches),
          pipeType: entry.pipeType,
          holeDiameterInches: decimal(entry.holeDiameterInches),
          bootModel: entry.bootModel,
          pricePerBoot:
            entry.pricePerBoot === null
              ? null
              : decimal(entry.pricePerBoot),
          sortOrder: index,
        })),
      });
    }
  });

  revalidatePath("/structures");
  revalidatePath("/structures/pipe-openings");
  redirect("/structures/pipe-openings");
}
