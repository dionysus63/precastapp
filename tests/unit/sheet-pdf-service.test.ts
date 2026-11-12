import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { fillRectSheetPdf } from "@/lib/rect-sheet-pdf-generate";
import type { RectStructureResult } from "@/lib/rect-structure";
import {
  createSheetPdf,
  deleteSheetPdf,
  readSheetPdfBytes,
  replaceSheetPdfFile,
} from "@/lib/sheet-pdf-service";

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(path.join(os.tmpdir(), "sheet-pdfs-"));
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(cwd, { recursive: true, force: true });
});

function pdfFile(content: string, name = "Sheet – v2.pdf") {
  return new File([`%PDF-1.7\n${content}`], name, { type: "application/pdf" });
}

const root = () => path.join(cwd, "storage", "rect-pdf-sets");

async function exists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function fakeClient(row?: Record<string, unknown>) {
  const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
    ...args.data,
  }));
  const update = vi.fn(
    async (args: { data: Record<string, unknown> }) => ({ ...row, ...args.data }),
  );
  const remove = vi.fn(async () => ({}));
  const client = {
    sheetPdf: {
      findUnique: vi.fn(async () => row ?? null),
      create,
      update,
      delete: remove,
    },
  } as unknown as PrismaClient;
  return { client, create, update, remove };
}

describe("Sheet PDF storage", () => {
  it("stores a new sheet as <id>.pdf in git-ignored storage/ and records a relative path", async () => {
    const { client, create } = fakeClient();
    const row = await createSheetPdf(
      client,
      {
        name: "  Rect box, top slab + base ",
        shape: "RECTANGULAR",
        hasTopSlab: true,
        hasBaseSlab: true,
      },
      pdfFile("new"),
    );

    const data = create.mock.calls[0][0].data;
    expect(data.name).toBe("Rect box, top slab + base");
    expect(data.filePath).toBe(`${data.id}.pdf`);
    expect(data).toMatchObject({ hasTopSlab: true, hasBaseSlab: true });
    expect(await readFile(path.join(root(), row.filePath), "utf8")).toContain(
      "new",
    );
  });

  it("a round sheet never carries a slab combination", async () => {
    const { client, create } = fakeClient();
    await createSheetPdf(
      client,
      { name: "Round", shape: "CIRCULAR", hasTopSlab: true, hasBaseSlab: true },
      pdfFile("round"),
    );
    expect(create.mock.calls[0][0].data).toMatchObject({
      shape: "CIRCULAR",
      hasTopSlab: false,
      hasBaseSlab: false,
    });
  });

  it("refuses a blank name or a non-PDF before anything is written", async () => {
    const { client, create } = fakeClient();
    await expect(
      createSheetPdf(
        client,
        { name: "  ", shape: "CIRCULAR", hasTopSlab: false, hasBaseSlab: false },
        pdfFile("x"),
      ),
    ).rejects.toThrow("Enter a name");
    await expect(
      createSheetPdf(
        client,
        { name: "Round", shape: "CIRCULAR", hasTopSlab: false, hasBaseSlab: false },
        pdfFile("x", "sheet.docx"),
      ),
    ).rejects.toThrow("not allowed");
    expect(create).not.toHaveBeenCalled();
    expect(await exists(root())).toBe(false);
  });

  it("leaves no file behind when the name is already taken", async () => {
    const { Prisma } = await import("@/app/generated/prisma/client");
    const { client, create } = fakeClient();
    create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    await expect(
      createSheetPdf(
        client,
        { name: "Round", shape: "CIRCULAR", hasTopSlab: false, hasBaseSlab: false },
        pdfFile("x"),
      ),
    ).rejects.toThrow("A Sheet PDF with that name already exists.");
    expect(await exists(root())).toBe(false);
  });

  it("replaces a sheet converted from a set in place, at its old set path", async () => {
    const converted = {
      id: "file1",
      name: "CB Standard - Top Slab, No Base",
      filePath: "cset123/topslab-nobase.pdf",
    };
    const stored = path.join(root(), "cset123", "topslab-nobase.pdf");
    await mkdir(path.dirname(stored), { recursive: true });
    await writeFile(stored, "old");

    const { client, update } = fakeClient(converted);
    await replaceSheetPdfFile(client, "file1", pdfFile("edited", "edited.pdf"));

    expect(await readFile(stored, "utf8")).toContain("edited");
    expect(await readdir(root())).toEqual(["cset123"]);
    expect(update.mock.calls[0][0].data).toMatchObject({
      originalName: "edited.pdf",
    });
    expect(Buffer.from(await readSheetPdfBytes(converted)).toString()).toContain(
      "edited",
    );
  });

  it("deletes an unused sheet and its file", async () => {
    const stored = path.join(root(), "abc.pdf");
    await mkdir(root(), { recursive: true });
    await writeFile(stored, "stored");

    const { client, remove } = fakeClient({
      id: "abc",
      filePath: "abc.pdf",
      _count: { templates: 0 },
    });
    await deleteSheetPdf(client, "abc");

    expect(await exists(stored)).toBe(false);
    expect(remove).toHaveBeenCalledWith({ where: { id: "abc" } });
  });

  it("keeps a sheet its templates still print on", async () => {
    const stored = path.join(root(), "abc.pdf");
    await mkdir(root(), { recursive: true });
    await writeFile(stored, "stored");

    const { client, remove } = fakeClient({
      id: "abc",
      filePath: "abc.pdf",
      _count: { templates: 2 },
    });
    await expect(deleteSheetPdf(client, "abc")).rejects.toThrow(
      "2 templates use this Sheet PDF. Pick another Sheet PDF on those templates first.",
    );
    expect(await exists(stored)).toBe(true);
    expect(remove).not.toHaveBeenCalled();
  });

  it("never reads outside the Sheet PDFs folder", async () => {
    await expect(
      readSheetPdfBytes({ filePath: "../../.env" }),
    ).rejects.toThrow("outside the Sheet PDFs folder");
    await expect(
      readSheetPdfBytes({ filePath: "C:\\Windows\\win.ini" }),
    ).rejects.toThrow();
  });
});

describe("filling a rectangular sheet", () => {
  const meta = {
    structureNumber: "CB-1",
    contractor: "",
    project: "",
    templateName: "4x6 Box",
    castingName: null,
  };
  const result = {
    hasTopSlab: true,
    hasBaseSlab: false,
  } as RectStructureResult;

  it("says so when the template has no Sheet PDF picked", async () => {
    const built = await fillRectSheetPdf(meta, result, null);
    expect(built).toEqual({
      ok: false,
      error: expect.stringContaining("no Sheet PDF picked"),
    });
  });

  it("refuses a Sheet PDF drawn for other slabs", async () => {
    const built = await fillRectSheetPdf(meta, result, {
      name: "Rect box, top slab + base",
      hasTopSlab: true,
      hasBaseSlab: true,
      filePath: "abc.pdf",
    });
    expect(built).toEqual({
      ok: false,
      error: expect.stringContaining(
        'is drawn for top slab + base, but this structure has top slab, no base',
      ),
    });
  });

  it("says so when the Sheet PDF's file is gone from the server", async () => {
    const built = await fillRectSheetPdf(meta, result, {
      name: "Rect box, top slab, no base",
      hasTopSlab: true,
      hasBaseSlab: false,
      filePath: "gone.pdf",
    });
    expect(built).toEqual({
      ok: false,
      error: expect.stringContaining("is missing from the server"),
    });
  });
});
