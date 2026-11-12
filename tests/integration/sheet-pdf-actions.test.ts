import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request (see
// delivery-status-guards.test.ts). Prisma and the action bodies run real.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));

import {
  createSheetPdfAction,
  deleteSheetPdfAction,
  renameSheetPdfAction,
  replaceSheetPdfFileAction,
} from "@/app/structures/sheet-pdfs/actions";
import { prisma } from "@/lib/prisma";
import {
  assertSheetPdfFitsTemplate,
  buildNestedCreate,
  parseTemplateData,
} from "@/lib/structure-template-payload";

const tag = `SHEETPDF-${Date.now()}`;
let cwd: string;

beforeAll(async () => {
  // Uploaded files land under the working directory's storage/ folder.
  cwd = await mkdtemp(path.join(os.tmpdir(), "sheet-pdf-actions-"));
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
});

afterAll(async () => {
  await prisma.structureTemplate.deleteMany({
    where: { name: { startsWith: tag } },
  });
  await prisma.sheetPdf.deleteMany({ where: { name: { startsWith: tag } } });
  vi.restoreAllMocks();
  await rm(cwd, { recursive: true, force: true });
});

function addForm(fields: {
  name: string;
  shape: "CIRCULAR" | "RECTANGULAR";
  hasTopSlab?: boolean;
  hasBaseSlab?: boolean;
  file?: boolean;
}): FormData {
  const formData = new FormData();
  formData.set("name", fields.name);
  formData.set("shape", fields.shape);
  if (fields.hasTopSlab) formData.set("hasTopSlab", "on");
  if (fields.hasBaseSlab) formData.set("hasBaseSlab", "on");
  if (fields.file !== false) {
    formData.set(
      "file",
      new File(["%PDF-1.7\nblank"], "blank.pdf", { type: "application/pdf" }),
    );
  }
  return formData;
}

function rectTemplateData(name: string, sheetPdfId: string | null, hasBase: boolean) {
  return {
    name,
    shape: "RECTANGULAR",
    wallThicknessInches: 6,
    hasTopSlab: true,
    topSlabThicknessInches: 8,
    hasBaseSlab: hasBase,
    baseSlabThicknessInches: hasBase ? 8 : 0,
    minimumBrickInches: 0,
    openingToJointMinTopInches: 6,
    openingToJointMinBottomInches: 6,
    sheetPdfId,
    rectSizes: [{ insideLengthInches: 48, insideWidthInches: 72 }],
  };
}

describe("Sheet PDF actions return user-facing errors", () => {
  it("adds a Sheet PDF, and returns { error } for a name already in use", async () => {
    expect(
      await createSheetPdfAction(
        addForm({
          name: `${tag} top + base`,
          shape: "RECTANGULAR",
          hasTopSlab: true,
          hasBaseSlab: true,
        }),
      ),
    ).toBeUndefined();

    const row = await prisma.sheetPdf.findFirstOrThrow({
      where: { name: `${tag} top + base` },
    });
    expect(row).toMatchObject({
      shape: "RECTANGULAR",
      hasTopSlab: true,
      hasBaseSlab: true,
      filePath: `${row.id}.pdf`,
      originalName: "blank.pdf",
    });

    expect(
      await createSheetPdfAction(
        addForm({ name: `${tag} top + base`, shape: "CIRCULAR" }),
      ),
    ).toEqual({ error: "A Sheet PDF with that name already exists." });
  });

  it("returns { error } when no file is chosen, the name is blank, or the row is gone", async () => {
    expect(
      await createSheetPdfAction(
        addForm({ name: `${tag} no file`, shape: "CIRCULAR", file: false }),
      ),
    ).toEqual({ error: "Choose the PDF file to add." });

    const row = await prisma.sheetPdf.findFirstOrThrow({
      where: { name: `${tag} top + base` },
    });
    expect(await renameSheetPdfAction(row.id, "   ")).toEqual({
      error: "Enter a name for the Sheet PDF.",
    });
    expect(await renameSheetPdfAction(`${tag}-missing`, "New name")).toEqual({
      error: "Sheet PDF not found.",
    });
    expect(await deleteSheetPdfAction(`${tag}-missing`)).toEqual({
      error: "Sheet PDF not found.",
    });

    const replace = new FormData();
    replace.set("id", `${tag}-missing`);
    replace.set(
      "file",
      new File(["%PDF-1.7\nedited"], "edited.pdf", { type: "application/pdf" }),
    );
    expect(await replaceSheetPdfFileAction(replace)).toEqual({
      error: "Sheet PDF not found.",
    });
  });

  it("renames a Sheet PDF, keeping names unique", async () => {
    await createSheetPdfAction(addForm({ name: `${tag} round`, shape: "CIRCULAR" }));
    const round = await prisma.sheetPdf.findFirstOrThrow({
      where: { name: `${tag} round` },
    });
    expect(round).toMatchObject({ hasTopSlab: false, hasBaseSlab: false });

    expect(await renameSheetPdfAction(round.id, `${tag} top + base`)).toEqual({
      error: "A Sheet PDF with that name already exists.",
    });
    expect(
      await renameSheetPdfAction(round.id, `${tag} round sheet`),
    ).toBeUndefined();
  });
});

describe("a template and its Sheet PDF", () => {
  it("only takes a Sheet PDF drawn for its shape and slabs", async () => {
    const sheetPdf = await prisma.sheetPdf.findFirstOrThrow({
      where: { name: `${tag} top + base` },
    });
    const round = await prisma.sheetPdf.findFirstOrThrow({
      where: { name: `${tag} round sheet` },
    });

    await expect(
      assertSheetPdfFitsTemplate(
        parseTemplateData(rectTemplateData(`${tag} Box`, sheetPdf.id, true)),
      ),
    ).resolves.toBeUndefined();

    await expect(
      assertSheetPdfFitsTemplate(
        parseTemplateData(
          rectTemplateData(`${tag} Box, No Base`, sheetPdf.id, false),
        ),
      ),
    ).rejects.toThrow(
      "is rectangular, top slab + base, but this template is rectangular, top slab, no base",
    );

    await expect(
      assertSheetPdfFitsTemplate(
        parseTemplateData(rectTemplateData(`${tag} Box`, round.id, true)),
      ),
    ).rejects.toThrow("is round, but this template is rectangular");

    await expect(
      assertSheetPdfFitsTemplate(
        parseTemplateData(rectTemplateData(`${tag} Box`, `${tag}-gone`, true)),
      ),
    ).rejects.toThrow("no longer exists");
  });

  it("cannot be deleted while a template prints on it", async () => {
    const sheetPdf = await prisma.sheetPdf.findFirstOrThrow({
      where: { name: `${tag} top + base` },
    });
    const template = await prisma.structureTemplate.create({
      data: buildNestedCreate(
        parseTemplateData(rectTemplateData(`${tag} Box`, sheetPdf.id, true)),
      ),
    });
    expect(template.sheetPdfId).toBe(sheetPdf.id);

    expect(await deleteSheetPdfAction(sheetPdf.id)).toEqual({
      error:
        "1 template uses this Sheet PDF. Pick another Sheet PDF on that template first.",
    });

    await prisma.structureTemplate.update({
      where: { id: template.id },
      data: { sheetPdfId: null },
    });
    expect(await deleteSheetPdfAction(sheetPdf.id)).toBeUndefined();
    expect(
      await prisma.sheetPdf.findUnique({ where: { id: sheetPdf.id } }),
    ).toBeNull();
  });
});
