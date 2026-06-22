"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type SectionRole = "BASE" | "RISER";

type StructureShape = "CIRCULAR" | "RECTANGULAR";

type StructureTemplateStatus = "ACTIVE" | "INACTIVE";

type SectionPayload = {
  role: SectionRole;
  heightFeet: number;
  label?: string | null;
};

type DiameterPayload = {
  insideDiameterFeet: number;
  moldMaxHeightFeet: number;
  topSlabHeightWithKeyFeet: number | null;
  topSlabHeightNoKeyFeet: number | null;
  sections: SectionPayload[];
};

type BootSizePayload = {
  pipeDiameterInches: number;
  holeDiameterInches: number;
};

type TemplatePayload = {
  name: string;
  agencyStandard: string | null;
  shape: StructureShape;
  minimumBrickFeet: number;
  keyClearanceFeet: number;
  status: StructureTemplateStatus;
  notes: string | null;
  diameters: DiameterPayload[];
  bootSizes: BootSizePayload[];
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

  const minimumBrickFeet = requireNonNegativeNumber(
    data.minimumBrickFeet,
    "Minimum brick",
  );
  const keyClearanceFeet = requireNonNegativeNumber(
    data.keyClearanceFeet,
    "Key clearance",
  );

  const diametersRaw = Array.isArray(data.diameters) ? data.diameters : [];
  if (diametersRaw.length === 0) {
    throw new Error("Add at least one diameter.");
  }

  const diameters: DiameterPayload[] = diametersRaw.map((item, index) => {
    const row = item as Record<string, unknown>;
    const insideDiameterFeet = requirePositiveNumber(
      row.insideDiameterFeet,
      `Diameter #${index + 1} inside diameter`,
    );
    const moldMaxHeightFeet = requirePositiveNumber(
      row.moldMaxHeightFeet,
      `Diameter #${index + 1} mold max height`,
    );
    const sectionsRaw = Array.isArray(row.sections) ? row.sections : [];
    const sections: SectionPayload[] = sectionsRaw
      .map((section) => {
        const sectionRow = section as Record<string, unknown>;
        const heightFeet = Number(sectionRow.heightFeet);
        if (!Number.isFinite(heightFeet) || heightFeet <= 0) {
          return null;
        }
        const role: SectionRole =
          sectionRow.role === "RISER" ? "RISER" : "BASE";
        const label = String(sectionRow.label ?? "").trim() || null;
        return { role, heightFeet, label };
      })
      .filter((section): section is SectionPayload => section !== null);

    return {
      insideDiameterFeet,
      moldMaxHeightFeet,
      topSlabHeightWithKeyFeet: optionalNonNegativeNumber(
        row.topSlabHeightWithKeyFeet,
      ),
      topSlabHeightNoKeyFeet: optionalNonNegativeNumber(
        row.topSlabHeightNoKeyFeet,
      ),
      sections,
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

  const bootRaw = Array.isArray(data.bootSizes) ? data.bootSizes : [];
  const bootSizes: BootSizePayload[] = bootRaw
    .map((item) => {
      const row = item as Record<string, unknown>;
      const pipeDiameterInches = Number(row.pipeDiameterInches);
      const holeDiameterInches = Number(row.holeDiameterInches);
      if (
        !Number.isFinite(pipeDiameterInches) ||
        pipeDiameterInches <= 0 ||
        !Number.isFinite(holeDiameterInches) ||
        holeDiameterInches <= 0
      ) {
        return null;
      }
      return { pipeDiameterInches, holeDiameterInches };
    })
    .filter((boot): boot is BootSizePayload => boot !== null);

  const bootKeys = new Set<number>();
  for (const boot of bootSizes) {
    if (bootKeys.has(boot.pipeDiameterInches)) {
      throw new Error(
        `Duplicate boot entry for a ${boot.pipeDiameterInches}" pipe.`,
      );
    }
    bootKeys.add(boot.pipeDiameterInches);
  }

  return {
    name,
    agencyStandard: String(data.agencyStandard ?? "").trim() || null,
    shape,
    minimumBrickFeet,
    keyClearanceFeet,
    status,
    notes: String(data.notes ?? "").trim() || null,
    diameters,
    bootSizes,
  };
}

function buildNestedCreate(payload: TemplatePayload) {
  return {
    name: payload.name,
    agencyStandard: payload.agencyStandard,
    shape: payload.shape,
    minimumBrickFeet: decimal(payload.minimumBrickFeet),
    keyClearanceFeet: decimal(payload.keyClearanceFeet),
    status: payload.status,
    notes: payload.notes,
    diameters: {
      create: payload.diameters.map((diameter, index) => ({
        insideDiameterFeet: decimal(diameter.insideDiameterFeet),
        moldMaxHeightFeet: decimal(diameter.moldMaxHeightFeet),
        topSlabHeightWithKeyFeet:
          diameter.topSlabHeightWithKeyFeet === null
            ? null
            : decimal(diameter.topSlabHeightWithKeyFeet),
        topSlabHeightNoKeyFeet:
          diameter.topSlabHeightNoKeyFeet === null
            ? null
            : decimal(diameter.topSlabHeightNoKeyFeet),
        sortOrder: index,
        sections: {
          create: diameter.sections.map((section, sectionIndex) => ({
            role: section.role,
            heightFeet: decimal(section.heightFeet),
            label: section.label,
            sortOrder: sectionIndex,
          })),
        },
      })),
    },
    bootSizes: {
      create: payload.bootSizes.map((boot) => ({
        pipeDiameterInches: decimal(boot.pipeDiameterInches),
        holeDiameterInches: decimal(boot.holeDiameterInches),
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
      await tx.structureTemplateBootSize.deleteMany({
        where: { templateId },
      });

      const nested = buildNestedCreate(payload);
      await tx.structureTemplate.update({
        where: { id: templateId },
        data: {
          name: nested.name,
          agencyStandard: nested.agencyStandard,
          shape: nested.shape,
          minimumBrickFeet: nested.minimumBrickFeet,
          keyClearanceFeet: nested.keyClearanceFeet,
          status: nested.status,
          notes: nested.notes,
          diameters: nested.diameters,
          bootSizes: nested.bootSizes,
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
