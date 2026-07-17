"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  getImportTypeDefinition,
  parseBooleanCell,
  templateDataFromCells,
  type StructureImportType,
} from "@/lib/structure-import";
import {
  buildNestedCreate,
  parseTemplateData,
} from "@/lib/structure-template-payload";

export type ImportRowMessage = { line: number; message: string };

export type StructureImportResult = {
  created: number;
  updated: number;
  errors: ImportRowMessage[];
  warnings: ImportRowMessage[];
};

type ImportRowInput = { lineNumber: number; cells: string[] };

function parseRowsPayload(formData: FormData): ImportRowInput[] {
  const raw = String(formData.get("rows") ?? "").trim();
  if (!raw) {
    throw new Error("No rows to import.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid import data.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("No rows to import.");
  }
  return parsed.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      lineNumber: Number(row.lineNumber) || 0,
      cells: Array.isArray(row.cells) ? row.cells.map((c) => String(c ?? "")) : [],
    };
  });
}

type CastingResolution =
  | { ok: true; id: string | null; name: string | null }
  | { ok: false; message: string };

/**
 * Resolves casting references (product code or exact product name, among
 * casting products) to product ids. Case-insensitive; ambiguous names fail.
 */
async function buildCastingResolver(): Promise<(ref: string) => CastingResolution> {
  const products = await prisma.product.findMany({
    where: { isCasting: true },
    select: { id: true, name: true, productCode: true },
  });
  const byCode = new Map<string, { id: string; name: string }>();
  const byName = new Map<string, { id: string; name: string } | "ambiguous">();
  for (const product of products) {
    byCode.set(product.productCode.trim().toLowerCase(), product);
    const nameKey = product.name.trim().toLowerCase();
    byName.set(nameKey, byName.has(nameKey) ? "ambiguous" : product);
  }

  return (ref: string) => {
    const key = ref.trim().toLowerCase();
    if (!key) {
      return { ok: true, id: null, name: null };
    }
    const codeMatch = byCode.get(key);
    if (codeMatch) {
      return { ok: true, id: codeMatch.id, name: codeMatch.name };
    }
    const nameMatch = byName.get(key);
    if (nameMatch === "ambiguous") {
      return {
        ok: false,
        message: `Casting "${ref}" matches more than one product — use the product code.`,
      };
    }
    if (nameMatch) {
      return { ok: true, id: nameMatch.id, name: nameMatch.name };
    }
    return {
      ok: false,
      message: `Casting "${ref}" not found among casting products (checked code and name).`,
    };
  };
}

/**
 * Preview enrichment: maps each pasted casting reference to the resolved
 * product name, or an error message. Keys are the raw references.
 */
export async function resolveCastingReferences(
  refs: string[],
): Promise<Record<string, { name: string } | { error: string }>> {
  await requirePermission(AppPermission.STRUCTURES_VIEW);
  const resolve = await buildCastingResolver();
  const out: Record<string, { name: string } | { error: string }> = {};
  for (const ref of new Set(refs.map((r) => r.trim()).filter(Boolean))) {
    const result = resolve(ref);
    out[ref] = result.ok
      ? { name: result.name ?? ref }
      : { error: result.message };
  }
  return out;
}

async function importTemplates(
  shape: "CIRCULAR" | "RECTANGULAR",
  rows: ImportRowInput[],
): Promise<StructureImportResult> {
  const resolveCasting = await buildCastingResolver();
  const result: StructureImportResult = {
    created: 0,
    updated: 0,
    errors: [],
    warnings: [],
  };

  const castingIndex = shape === "CIRCULAR" ? 12 : 16;

  for (const row of rows) {
    try {
      const castingRef = row.cells[castingIndex] ?? "";
      const casting = resolveCasting(castingRef);
      if (!casting.ok) {
        throw new Error(casting.message);
      }

      const payload = parseTemplateData(
        templateDataFromCells(shape, row.cells, casting.id),
      );

      const existing = await prisma.structureTemplate.findFirst({
        where: { name: payload.name },
        select: { id: true, shape: true, rectPdfSetId: true },
      });

      if (existing) {
        if (existing.shape !== shape) {
          throw new Error(
            `An existing template named "${payload.name}" is ${existing.shape === "CIRCULAR" ? "circular" : "rectangular"} — cannot change its shape via import.`,
          );
        }
        const nested = buildNestedCreate(payload);
        await prisma.$transaction(async (tx) => {
          await tx.structureTemplateDiameter.deleteMany({
            where: { templateId: existing.id },
          });
          await tx.structureTemplateRectSize.deleteMany({
            where: { templateId: existing.id },
          });
          await tx.structureTemplate.update({
            where: { id: existing.id },
            data: {
              ...nested,
              // Import columns never carry a set — keep the assigned one.
              rectPdfSetId: existing.rectPdfSetId,
            },
          });
        });
        result.updated += 1;
      } else {
        await prisma.structureTemplate.create({
          data: buildNestedCreate(payload),
        });
        result.created += 1;
      }
    } catch (error) {
      result.errors.push({
        line: row.lineNumber,
        message: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }

  revalidatePath("/structures");
  return result;
}

export async function importStructureTemplates(
  formData: FormData,
): Promise<StructureImportResult> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const type = String(formData.get("type") ?? "") as StructureImportType;
  getImportTypeDefinition(type);
  if (type !== "circular-templates" && type !== "rect-templates") {
    throw new Error("Wrong import action for this type.");
  }
  const rows = parseRowsPayload(formData);
  return importTemplates(
    type === "circular-templates" ? "CIRCULAR" : "RECTANGULAR",
    rows,
  );
}

export async function importRectOpenings(
  formData: FormData,
): Promise<StructureImportResult> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const rows = parseRowsPayload(formData);
  const result: StructureImportResult = {
    created: 0,
    updated: 0,
    errors: [],
    warnings: [],
  };

  const maxAggregate = await prisma.rectOpeningSize.aggregate({
    _max: { sortOrder: true },
  });
  let nextSortOrder = (maxAggregate._max.sortOrder ?? -1) + 1;

  for (const row of rows) {
    try {
      const [material, size, width, height, wallThk, price] = row.cells;
      const pipeMaterial = (material ?? "").trim();
      if (!pipeMaterial) {
        throw new Error("Material is required.");
      }
      const data = {
        openingWidthInches: String(Number(width)),
        openingHeightInches: String(Number(height)),
        pipeWallThicknessInches: (wallThk ?? "").trim()
          ? String(Number(wallThk))
          : "0",
        pricePerOpening: (price ?? "").trim() ? String(Number(price)) : null,
      };
      const where = {
        pipeMaterial_pipeSizeInches: {
          pipeMaterial,
          pipeSizeInches: String(Number(size)),
        },
      };
      const existing = await prisma.rectOpeningSize.findUnique({ where });
      if (existing) {
        await prisma.rectOpeningSize.update({ where, data });
        result.updated += 1;
      } else {
        await prisma.rectOpeningSize.create({
          data: {
            pipeMaterial,
            pipeSizeInches: String(Number(size)),
            ...data,
            sortOrder: nextSortOrder,
          },
        });
        nextSortOrder += 1;
        result.created += 1;
      }
    } catch (error) {
      result.errors.push({
        line: row.lineNumber,
        message: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }

  revalidatePath("/structures/rect-openings");
  return result;
}

export async function importPipeOpenings(
  formData: FormData,
): Promise<StructureImportResult> {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const rows = parseRowsPayload(formData);
  const result: StructureImportResult = {
    created: 0,
    updated: 0,
    errors: [],
    warnings: [],
  };

  const maxAggregate = await prisma.pipeOpeningSize.aggregate({
    _max: { sortOrder: true },
  });
  let nextSortOrder = (maxAggregate._max.sortOrder ?? -1) + 1;

  for (const row of rows) {
    try {
      const [material, size, holeDia, wallThk, hasBootCell, bootModel, bootPrice] =
        row.cells;
      const pipeMaterial = (material ?? "").trim();
      if (!pipeMaterial) {
        throw new Error("Material is required.");
      }
      const hasBoot = parseBooleanCell(hasBootCell ?? "");
      if (hasBoot === null) {
        throw new Error(`Has boot "${hasBootCell}" must be Yes or No.`);
      }

      const pipeSizeInches = String(Number(size));
      // New rows always use pipeType "" — warn when a legacy row with a
      // non-empty pipeType shares the material/size/boot combination, since
      // the import cannot tell whether it should have been updated instead.
      const legacy = await prisma.pipeOpeningSize.findFirst({
        where: {
          pipeMaterial,
          pipeSizeInches,
          hasBoot,
          NOT: { pipeType: "" },
        },
        select: { pipeType: true },
      });
      if (legacy) {
        result.warnings.push({
          line: row.lineNumber,
          message: `A legacy "${pipeMaterial}" ${size}" row with pipe type "${legacy.pipeType}" also exists — review for duplicates.`,
        });
      }

      const data = {
        holeDiameterInches: String(Number(holeDia)),
        pipeWallThicknessInches: (wallThk ?? "").trim()
          ? String(Number(wallThk))
          : "0",
        bootModel: (bootModel ?? "").trim() || null,
        pricePerBoot: (bootPrice ?? "").trim() ? String(Number(bootPrice)) : null,
      };
      const where = {
        pipeMaterial_pipeSizeInches_pipeType_hasBoot: {
          pipeMaterial,
          pipeSizeInches,
          pipeType: "",
          hasBoot,
        },
      };
      const existing = await prisma.pipeOpeningSize.findUnique({ where });
      if (existing) {
        await prisma.pipeOpeningSize.update({ where, data });
        result.updated += 1;
      } else {
        await prisma.pipeOpeningSize.create({
          data: {
            pipeMaterial,
            pipeSizeInches,
            pipeType: "",
            hasBoot,
            ...data,
            sortOrder: nextSortOrder,
          },
        });
        nextSortOrder += 1;
        result.created += 1;
      }
    } catch (error) {
      result.errors.push({
        line: row.lineNumber,
        message: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }

  revalidatePath("/structures/pipe-openings");
  return result;
}
