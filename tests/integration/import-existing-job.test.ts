import { mkdtemp, rm } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import os from "os";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request (see
// one-off-drill-sheets.test.ts). Job folders are real directories under a
// temp root so the PDFs are actually written and split.
const folders = vi.hoisted(() => ({ root: "" }));
// The quote's createdBy must be a real user row: filled in beforeAll.
const actor = vi.hoisted(() => ({ id: "", displayName: "Import Tester" }));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn(async () => actor),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/job-folders", async () => {
  const { mkdir } = await import("fs/promises");
  const pathModule = await import("path");
  return {
    createJobFoldersForJob: vi.fn(async ({ jobNumber }: { jobNumber: string }) => {
      const folder = pathModule.join(folders.root, jobNumber);
      await mkdir(folder, { recursive: true });
      return folder;
    }),
  };
});

import { importExistingJob } from "@/app/jobs/import-actions";
import { isActionError } from "@/lib/action-result";
import { importFileField, type ImportJobPayload } from "@/lib/job-import";
import { prisma } from "@/lib/prisma";

const tag = `IMPORT-${Date.now()}`;
let productId: string;
let categoryId: string;
const jobIds: string[] = [];

async function pdfWithPages(count: number): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let index = 0; index < count; index += 1) {
    document.addPage([612, 792]);
  }
  return document.save();
}

function pdfFile(bytes: Uint8Array, name: string): File {
  return new File([bytes as Uint8Array<ArrayBuffer>], name, { type: "application/pdf" });
}

function newJob(projectName: string): ImportJobPayload["job"] {
  return {
    mode: "new",
    customerId: null,
    customerName: `${tag} Contractor`,
    projectName,
    projectAddress: "",
    city: "",
    state: "",
    zip: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  };
}

beforeAll(async () => {
  folders.root = await mkdtemp(path.join(os.tmpdir(), "import-job-"));
  const user = await prisma.user.create({
    data: {
      username: `${tag}-user`.toLowerCase(),
      displayName: `${tag} User`,
      initials: "IT",
      role: "MANAGER",
    },
  });
  actor.id = user.id;
  const category = await prisma.productCategory.create({
    data: { name: `${tag} castings`, productType: "CASTING" },
  });
  categoryId = category.id;
  const product = await prisma.product.create({
    data: {
      productCode: `${tag}-FRAME`,
      name: `${tag} 24in frame and cover`,
      categoryId,
      productType: "CASTING",
      trackInventory: false,
      weight: 300,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  for (const jobId of jobIds) {
    await prisma.jobStructure.deleteMany({ where: { jobId } });
    await prisma.quote.deleteMany({ where: { jobId } });
    await prisma.job.delete({ where: { id: jobId } }).catch(() => {});
  }
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.productCategory.deleteMany({ where: { id: categoryId } });
  await prisma.user.deleteMany({ where: { id: actor.id } });
  await rm(folders.root, { recursive: true, force: true });
});

describe("importExistingJob", () => {
  it("creates the job, a won quote, structures with statuses, and files every PDF", async () => {
    const drillSheets = await pdfWithPages(4);
    const payload: ImportJobPayload = {
      job: newJob(`${tag} In Production`),
      phase: "IN_PRODUCTION",
      quote: { quoteNumber: `${tag}-Q1`, quoteDate: "2026-08-14", taxRate: "0" },
      files: [
        { key: "q", kind: "QUOTE", name: "Quote R2.pdf", combined: false },
        { key: "d", kind: "DRILL_SHEET", name: "Drill Sheets ALL.pdf", combined: true },
        { key: "s", kind: "SUBMITTAL", name: "CB-2 submittal.pdf", combined: false },
      ],
      rows: [
        {
          kind: "STRUCTURE",
          key: "r1",
          structureNumber: "MH-1",
          description: "5' dia manhole",
          quantity: "1",
          unitPrice: "$6,850.00",
          weightLbs: "12000",
          status: "IN_PRODUCTION",
          docs: { DRILL_SHEET: { fileKey: "d", pages: [1, 2] } },
        },
        {
          kind: "STRUCTURE",
          key: "r2",
          structureNumber: "CB-1",
          description: "4x4 catch basin",
          quantity: "1",
          unitPrice: "3180",
          weightLbs: "",
          status: "APPROVED",
          docs: { DRILL_SHEET: { fileKey: "d", pages: [3] } },
        },
        {
          kind: "STRUCTURE",
          key: "r3",
          structureNumber: "CB-2",
          description: "4x4 catch basin",
          quantity: "1",
          unitPrice: "3180",
          weightLbs: "",
          status: "MADE",
          docs: {
            DRILL_SHEET: { fileKey: "d", pages: [4] },
            SUBMITTAL: { fileKey: "s", pages: null },
          },
        },
        {
          kind: "PRODUCT",
          key: "p1",
          productId,
          productLabel: "Frame",
          description: "",
          quantity: "3",
          unitPrice: "450",
          unit: "EA",
        },
      ],
    };
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    formData.set(importFileField("q"), pdfFile(await pdfWithPages(2), "Quote R2.pdf"));
    formData.set(importFileField("d"), pdfFile(drillSheets, "Drill Sheets ALL.pdf"));
    formData.set(importFileField("s"), pdfFile(await pdfWithPages(1), "CB-2 submittal.pdf"));

    const result = await importExistingJob(formData);
    if (isActionError(result)) {
      throw new Error(result.error);
    }
    jobIds.push(result.jobId);

    expect(result.errors).toEqual([]);
    expect(result.jobCreated).toBe(true);
    expect(result.quoteNumber).toBe(`${tag}-Q1`);
    expect(result.structureCount).toBe(3);
    expect(result.productLineCount).toBe(1);

    const job = await prisma.job.findUniqueOrThrow({ where: { id: result.jobId } });
    expect(job.status).toBe("ACTIVE");
    expect(job.awardedDate).not.toBeNull();

    const quote = await prisma.quote.findUniqueOrThrow({
      where: { id: result.quoteId },
      include: { lineItems: { orderBy: { lineNumber: "asc" } } },
    });
    expect(quote.status).toBe("WON");
    expect(quote.lineItems.map((line) => [line.lineType, line.itemCode])).toEqual([
      ["CUSTOM_STRUCTURE", "MH-1"],
      ["CUSTOM_STRUCTURE", "CB-1"],
      ["CUSTOM_STRUCTURE", "CB-2"],
      ["STOCK_PRODUCT", `${tag}-FRAME`],
    ]);
    // 6850 + 3180 + 3180 + 3 × 450
    expect(quote.subtotal.toString()).toBe("14560");
    expect(quote.lineItems[3]!.productId).toBe(productId);
    expect(quote.lineItems.slice(0, 3).every((line) => line.jobStructureId)).toBe(true);

    const structures = await prisma.jobStructure.findMany({
      where: { jobId: result.jobId },
      include: { documents: true },
      orderBy: { structureNumber: "asc" },
    });
    const byNumber = new Map(structures.map((s) => [s.structureNumber, s]));
    expect(byNumber.get("MH-1")!.status).toBe("IN_PRODUCTION");
    expect(byNumber.get("MH-1")!.productionDate).not.toBeNull();
    expect(byNumber.get("MH-1")!.madeDate).toBeNull();
    expect(byNumber.get("MH-1")!.weight?.toString()).toBe("12000");
    expect(byNumber.get("CB-1")!.status).toBe("APPROVED");
    expect(byNumber.get("CB-2")!.status).toBe("MADE");
    expect(byNumber.get("CB-2")!.madeDate).not.toBeNull();

    // Pages cut out of the combined PDF, one file per structure.
    const mhSheet = byNumber.get("MH-1")!.documents.find(
      (doc) => doc.documentType === "PRODUCTION_DRAWING",
    )!;
    expect(mhSheet.documentName).toBe("MH-1 Drill Sheet.pdf");
    const mhPdf = await PDFDocument.load(readFileSync(mhSheet.filePath));
    expect(mhPdf.getPageCount()).toBe(2);
    const cb2Docs = byNumber.get("CB-2")!.documents.map((doc) => doc.documentType).sort();
    expect(cb2Docs).toEqual(["JOB_SPECIFIC_SUBMITTAL", "PRODUCTION_DRAWING"]);

    // The quote PDF and the combined original land in the job folder.
    const jobFiles = await prisma.jobFile.findMany({ where: { jobId: result.jobId } });
    expect(jobFiles.map((file) => [file.folderCategory, file.fileName]).sort()).toEqual([
      ["02 Quotes", "Quote R2.pdf"],
      ["08 Production", "Drill Sheets ALL.pdf"],
    ]);
    for (const file of jobFiles) {
      expect(existsSync(file.filePath)).toBe(true);
    }
    expect(result.filesSaved).toBe(6);
  });

  it("keeps a quoted-only job to the quote: no structures, quote Sent", async () => {
    const payload: ImportJobPayload = {
      job: newJob(`${tag} Quoted`),
      phase: "QUOTED",
      quote: { quoteNumber: "", quoteDate: "2026-09-01", taxRate: "8.625" },
      files: [],
      rows: [
        {
          kind: "STRUCTURE",
          key: "r1",
          structureNumber: "MH-1",
          description: "",
          quantity: "2",
          unitPrice: "1000",
          weightLbs: "",
          status: "NOT_SUBMITTED",
          docs: {},
        },
      ],
    };
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    const result = await importExistingJob(formData);
    if (isActionError(result)) {
      throw new Error(result.error);
    }
    jobIds.push(result.jobId);

    expect(result.structureCount).toBe(0);
    const job = await prisma.job.findUniqueOrThrow({ where: { id: result.jobId } });
    expect(job.status).toBe("QUOTING");
    const quote = await prisma.quote.findUniqueOrThrow({ where: { id: result.quoteId } });
    expect(quote.status).toBe("SENT");
    expect(quote.quoteNumber.startsWith(`Q-${job.jobNumber}`)).toBe(true);
    // 2000 taxed at 8.625%
    expect(quote.total.toString()).toBe("2172.5");
    expect(await prisma.jobStructure.count({ where: { jobId: result.jobId } })).toBe(0);
  });

  it("rejects bad rows before writing anything", async () => {
    const before = await prisma.job.count();
    const payload: ImportJobPayload = {
      job: newJob(`${tag} Bad`),
      phase: "APPROVED",
      quote: { quoteNumber: "", quoteDate: "", taxRate: "0" },
      files: [],
      rows: ["MH-1", "mh-1"].map((structureNumber, index) => ({
        kind: "STRUCTURE" as const,
        key: `r${index}`,
        structureNumber,
        description: "",
        quantity: "1",
        unitPrice: "10",
        weightLbs: "",
        status: "APPROVED" as const,
        docs: {},
      })),
    };
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    const result = await importExistingJob(formData);
    expect(isActionError(result) && result.error).toMatch(/used twice/);
    expect(await prisma.job.count()).toBe(before);
  });
});
