import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/app/generated/prisma/client";
import {
  deleteRectPdfSetFile,
  readRectPdfSetFileBytes,
  saveRectPdfSetFile,
} from "@/lib/rect-pdf-set-service";

const SET_ID = "cset123";
const KEY = { setId: SET_ID, hasTopSlab: true, hasBaseSlab: false };

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(path.join(os.tmpdir(), "rect-pdf-sets-"));
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(cwd, { recursive: true, force: true });
});

function pdfFile(content: string) {
  return new File([`%PDF-1.7\n${content}`], "Sheet – v2.pdf", {
    type: "application/pdf",
  });
}

function fakeClient(row?: Record<string, unknown>) {
  const upsert = vi.fn(async (args: { create: Record<string, unknown> }) => ({
    id: "file1",
    ...args.create,
  }));
  const remove = vi.fn(async () => ({}));
  const client = {
    rectSheetPdfSet: { findUnique: vi.fn(async () => ({ id: SET_ID })) },
    rectSheetPdfSetFile: {
      findUnique: vi.fn(async () => row ?? null),
      upsert,
      delete: remove,
    },
  } as unknown as PrismaClient;
  return { client, upsert, remove };
}

async function exists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

const storagePath = () =>
  path.join(cwd, "storage", "rect-pdf-sets", SET_ID, "topslab-nobase.pdf");

describe("rect PDF set storage", () => {
  it("writes uploads to git-ignored storage/ and records a relative path", async () => {
    const { client, upsert } = fakeClient();
    await saveRectPdfSetFile(
      client,
      SET_ID,
      { hasTopSlab: true, hasBaseSlab: false },
      pdfFile("new"),
    );

    expect(await readFile(storagePath(), "utf8")).toContain("new");
    expect(upsert.mock.calls[0][0].create.filePath).toBe(
      `${SET_ID}/topslab-nobase.pdf`,
    );
  });

  it("deletes the stored file and its row", async () => {
    await mkdir(path.dirname(storagePath()), { recursive: true });
    await writeFile(storagePath(), "stored");

    const { client, remove } = fakeClient({ id: "file1", ...KEY });
    await deleteRectPdfSetFile(client, "file1");

    expect(await exists(storagePath())).toBe(false);
    expect(remove).toHaveBeenCalledWith({ where: { id: "file1" } });
  });

  it("ignores a stale absolute filePath on old rows", async () => {
    await mkdir(path.dirname(storagePath()), { recursive: true });
    await writeFile(storagePath(), "stored");
    const row = {
      ...KEY,
      filePath: "C:\\Projects\\precastapp\\assets\\templates\\rect-pdf-sets\\x.pdf",
    };
    expect(Buffer.from(await readRectPdfSetFileBytes(row)).toString()).toBe(
      "stored",
    );
  });
});
