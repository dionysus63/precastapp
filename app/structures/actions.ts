"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type StructureShape = "CIRCULAR" | "RECTANGULAR";
type StructureTemplateStatus = "ACTIVE" | "INACTIVE";
type PipeConnectionType = "KOR_N_SEAL" | "CAST_IN" | "GROUTED" | "OTHER";
type SumpMode = "DEFAULT" | "FIXED";

type DiameterPayload = {
  insideDiameterFeet: number;
};

type TemplatePayload = {
  name: string;
  agencyStandard: string | null;
  shape: StructureShape;
  wallThicknessInches: number;
  baseSlabThicknessInches: number;
  topSlabThicknessInches: number;
  castingProductId: string | null;
  minimumBrickInches: number;
  connectionType: PipeConnectionType;
  sumpMode: SumpMode;
  sumpFixedInches: number | null;
  openingToJointMinTopInches: number;
  openingToJointMinBottomInches: number;
  status: StructureTemplateStatus;
  notes: string | null;
  diameters: DiameterPayload[];
};

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(String(value));
}

function requirePositiveNumber(value: unknown, label: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return num;
}

function requireNonNegativeNumber(value: unknown, label: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
  return num;
}

function optionalNonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return num;
}

function parseTemplatePayload(formData: FormData): TemplatePayload {
  const raw = String(formData.get("payload") ?? "").trim();
  if (!raw) {
    throw new Error("Missing template data.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid template data.");
  }

  const data = parsed as Record<string, unknown>;

  const name = String(data.name ?? "").trim();
  if (!name) {
    throw new Error("Template name is required.");
  }

  const shape: StructureShape =
    data.shape === "RECTANGULAR" ? "RECTANGULAR" : "CIRCULAR";
  const status: StructureTemplateStatus =
    data.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  const connectionTypes: PipeConnectionType[] = [
    "KOR_N_SEAL",
    "CAST_IN",
    "GROUTED",
    "OTHER",
  ];
  const connectionType = connectionTypes.includes(
    data.connectionType as PipeConnectionType,
  )
    ? (data.connectionType as PipeConnectionType)
    : "KOR_N_SEAL";

  const sumpMode: SumpMode = data.sumpMode === "FIXED" ? "FIXED" : "DEFAULT";

  const diametersRaw = Array.isArray(data.diameters) ? data.diameters : [];
  if (diametersRaw.length === 0) {
    throw new Error("Add at least one diameter.");
  }

  const diameters: DiameterPayload[] = diametersRaw.map((item, index) => {
    const row = item as Record<string, unknown>;
    return {
      insideDiameterFeet: requirePositiveNumber(
        row.insideDiameterFeet,
        `Diameter #${index + 1} inside diameter`,
      ),
    };
  });

  const diameterKeys = new Set<number>();
  for (const diameter of diameters) {
    if (diameterKeys.has(diameter.insideDiameterFeet)) {
      throw new Error(
        `Duplicate diameter ${diameter.insideDiameterFeet}' in template.`,
      );
    }
    diameterKeys.add(diameter.insideDiameterFeet);
  }

  return {
    name,
    agencyStandard: String(data.agencyStandard ?? "").trim() || null,
    shape,
    wallThicknessInches: requirePositiveNumber(
      data.wallThicknessInches,
      "Wall thickness",
    ),
    baseSlabThicknessInches: requirePositiveNumber(
      data.baseSlabThicknessInches,
      "Base slab thickness",
    ),
    topSlabThicknessInches: requirePositiveNumber(
      data.topSlabThicknessInches,
      "Top slab thickness",
    ),
    castingProductId: data.castingProductId
      ? String(data.castingProductId)
      : null,
    minimumBrickInches: requireNonNegativeNumber(
      data.minimumBrickInches,
      "Minimum brick",
    ),
    connectionType,
    sumpMode,
    sumpFixedInches:
      sumpMode === "FIXED"
        ? requirePositiveNumber(data.sumpFixedInches, "Fixed sump distance")
        : optionalNonNegativeNumber(data.sumpFixedInches),
    openingToJointMinTopInches: requireNonNegativeNumber(
      data.openingToJointMinTopInches,
      "Opening-to-joint min (top)",
    ),
    openingToJointMinBottomInches: requireNonNegativeNumber(
      data.openingToJointMinBottomInches,
      "Opening-to-joint min (bottom)",
    ),
    status,
    notes: String(data.notes ?? "").trim() || null,
    diameters,
  };
}

function buildNestedCreate(payload: TemplatePayload) {
  return {
    name: payload.name,
    agencyStandard: payload.agencyStandard,
    shape: payload.shape,
    wallThicknessInches: decimal(payload.wallThicknessInches),
    baseSlabThicknessInches: decimal(payload.baseSlabThicknessInches),
    topSlabThicknessInches: decimal(payload.topSlabThicknessInches),
    castingProductId: payload.castingProductId,
    minimumBrickInches: decimal(payload.minimumBrickInches),
    connectionType: payload.connectionType,
    sumpMode: payload.sumpMode,
    sumpFixedInches:
      payload.sumpFixedInches === null
        ? null
        : decimal(payload.sumpFixedInches),
    openingToJointMinTopInches: decimal(payload.openingToJointMinTopInches),
    openingToJointMinBottomInches: decimal(
      payload.openingToJointMinBottomInches,
    ),
    status: payload.status,
    notes: payload.notes,
    diameters: {
      create: payload.diameters.map((diameter, index) => ({
        insideDiameterFeet: decimal(diameter.insideDiameterFeet),
        sortOrder: index,
      })),
    },
  };
}

function handlePrismaError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new Error("A structure template with that name already exists.");
  }
  throw error;
}

export async function createStructureTemplate(formData: FormData) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const payload = parseTemplatePayload(formData);

  try {
    await prisma.structureTemplate.create({
      data: buildNestedCreate(payload),
    });
  } catch (error) {
    handlePrismaError(error);
  }

  revalidatePath("/structures");
  redirect("/structures");
}

export async function updateStructureTemplate(
  templateId: string,
  formData: FormData,
) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);
  const payload = parseTemplatePayload(formData);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.structureTemplateDiameter.deleteMany({
        where: { templateId },
      });

      const nested = buildNestedCreate(payload);
      await tx.structureTemplate.update({
        where: { id: templateId },
        data: {
          name: nested.name,
          agencyStandard: nested.agencyStandard,
          shape: nested.shape,
          wallThicknessInches: nested.wallThicknessInches,
          baseSlabThicknessInches: nested.baseSlabThicknessInches,
          topSlabThicknessInches: nested.topSlabThicknessInches,
          castingProductId: nested.castingProductId,
          minimumBrickInches: nested.minimumBrickInches,
          connectionType: nested.connectionType,
          sumpMode: nested.sumpMode,
          sumpFixedInches: nested.sumpFixedInches,
          openingToJointMinTopInches: nested.openingToJointMinTopInches,
          openingToJointMinBottomInches: nested.openingToJointMinBottomInches,
          status: nested.status,
          notes: nested.notes,
          diameters: nested.diameters,
        },
      });
    });
  } catch (error) {
    handlePrismaError(error);
  }

  revalidatePath("/structures");
  revalidatePath(`/structures/${templateId}`);
  redirect("/structures");
}

export async function deleteStructureTemplate(templateId: string) {
  await requirePermission(AppPermission.STRUCTURES_MANAGE);

  await prisma.structureTemplate.delete({ where: { id: templateId } });

  revalidatePath("/structures");
  redirect("/structures");
}

export async function loadCastingProductOptions() {
  await requirePermission(AppPermission.STRUCTURES_VIEW);
  const products = await prisma.product.findMany({
    where: { isCasting: true, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, heightFeet: true },
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    heightFeet: p.heightFeet ? Number(p.heightFeet) : null,
  }));
}
