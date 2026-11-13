import { mkdir, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request. Everything
// else runs real: Prisma, the PDF reader, the files on disk.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
}));
vi.mock("@/lib/auth/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));

const folders = vi.hoisted(() => ({ jobsRoot: "" }));
vi.mock("@/lib/app-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/app-settings")>()),
  getJobsRoot: async () => folders.jobsRoot,
}));

import {
  cancelStillOutTicketAction,
  closeStillOutTicketAction,
  discardTicketScan,
  fileTicketScan,
  moveStillOutTicketDateAction,
  readTicketScanPages,
  reopenStillOutTicketAction,
  restoreStillOutTicketDateAction,
  setTicketScanChoice,
  setTicketScanPageSkipped,
  setTicketScanPageTicket,
  turnTicketScanPage,
  uploadTicketScans,
  pickTicketScanPageCopy,
} from "@/app/invoices/scan-actions";
import { getAppSettings } from "@/lib/app-settings";
import { buildQrModulePath } from "@/lib/delivery-ticket-pdf-scan-code";
import { addLocalDays, startOfLocalDay, toLocalDayInput } from "@/lib/date-only";
import { prisma } from "@/lib/prisma";
import { buildTicketScanCode, ticketScanCheck } from "@/lib/ticket-scan-code";
import { renderPdfPageImage } from "@/lib/ticket-scan/reader";
import type {
  ScanInActionResult,
  ScanInRow,
  ScanInView,
} from "@/lib/ticket-scan/view-types";

const stamp = String(Date.now()).slice(-6);
const tag = `SCANIN-${stamp}`;
const customerName = `${tag} Contractor`;
/** Ticket numbers look like the real thing: letters, then digits. */
const number = (suffix: number) => `ZS${stamp}${suffix}`;

let storageDir: string;
let productId: string;
let jobId: string;
let jobFolder: string;

type TestTicket = { id: string; ticketNumber: string };
const tickets: Record<string, TestTicket> = {};

async function createTicket(
  key: string,
  suffix: number,
  data: {
    status?: "SCHEDULED" | "DELIVERED" | "CANCELLED";
    deliveryDate?: Date;
    deliveredAt?: Date;
    jobId?: string;
  } = {},
): Promise<TestTicket> {
  const ticket = await prisma.deliveryTicket.create({
    data: {
      ticketNumber: number(suffix),
      year: 2026,
      customerName,
      projectName: `${tag} project ${key}`,
      status: data.status ?? "SCHEDULED",
      deliveryDate: data.deliveryDate ?? startOfLocalDay(),
      deliveredAt: data.deliveredAt,
      jobId: data.jobId,
      lineItems: {
        create: {
          lineNumber: 1,
          lineType: "STOCK_PRODUCT",
          productId,
          itemCode: `${tag}-P1`,
          quantity: 1,
          unit: "EA",
          unitPrice: 50,
        },
      },
    },
  });
  tickets[key] = { id: ticket.id, ticketNumber: ticket.ticketNumber! };
  return tickets[key]!;
}

type ScanPageSpec =
  | { code: string; turn?: 0 | 90 | 180 | 270 }
  | { text: string }
  | { blank: true };

function codeFor(
  ticket: TestTicket,
  options: { copy?: number; page?: number; of?: number; check?: string } = {},
): string {
  return buildTicketScanCode({
    ticketNumber: ticket.ticketNumber,
    copyNumber: options.copy ?? 1,
    pageNumber: options.page ?? 1,
    pageCount: options.of ?? 1,
    check: options.check ?? ticketScanCheck(ticket.id),
  });
}

/** A "scan": one letter page per spec, the code where the ticket prints it. */
async function buildScan(pages: ScanPageSpec[], name: string): Promise<File> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const spec of pages) {
    const page = document.addPage([612, 792]);
    if ("blank" in spec) {
      continue;
    }
    if ("text" in spec) {
      page.drawText(spec.text, { x: 60, y: 600, size: 12, font });
      continue;
    }
    page.drawText("DELIVERY TICKET", { x: 60, y: 720, size: 18, font });
    const { path: qrPath, size } = buildQrModulePath(spec.code);
    page.drawSvgPath(qrPath, {
      x: 525.5,
      y: 86,
      scale: 50 / size,
      color: rgb(0, 0, 0),
      borderWidth: 0,
    });
    if (spec.turn) {
      page.setRotation(degrees(spec.turn));
    }
  }
  const bytes = await document.save();
  return new File([Buffer.from(bytes)], name, { type: "application/pdf" });
}

function viewOf(result: ScanInActionResult): ScanInView {
  if ("error" in result) {
    throw new Error(`Action failed: ${result.error}`);
  }
  return result.view;
}

async function upload(file: File): Promise<ScanInView> {
  const formData = new FormData();
  formData.append("files", file);
  let view = viewOf(await uploadTicketScans(formData));
  // The screen asks for the reading in small bites until none are waiting.
  for (let turn = 0; turn < 30 && (view.open?.counts.reading ?? 0) > 0; turn += 1) {
    view = viewOf(await readTicketScanPages(view.open!.id, null));
  }
  expect(view.open?.counts.reading ?? 0).toBe(0);
  return view;
}

function rowFor(view: ScanInView, pgLabel: string): ScanInRow {
  const row = view.rows.find((entry) => entry.pgLabel === pgLabel);
  if (!row) {
    throw new Error(
      `No row ${pgLabel}; rows are ${view.rows.map((entry) => entry.pgLabel).join(", ")}`,
    );
  }
  return row;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

const signedPath = (...parts: string[]) =>
  path.join(storageDir, "signed-tickets", ...parts);

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(os.tmpdir(), "scan-in-storage-"));
  process.env.PRECASTAPP_STORAGE_DIR = storageDir;
  folders.jobsRoot = await mkdtemp(path.join(os.tmpdir(), "scan-in-jobs-"));
  jobFolder = path.join(folders.jobsRoot, `${tag} job`);
  await mkdir(jobFolder, { recursive: true });

  // Scan In only chases tickets delivered after it went live.
  await getAppSettings(); // makes the settings row on a fresh database
  await prisma.appSettings.update({
    where: { id: "default" },
    data: { scanInStartedAt: new Date(2020, 0, 1) },
  });
  // A scan left open by an earlier, interrupted run would mix in.
  await prisma.ticketScanBatch.deleteMany({ where: { status: "OPEN" } });

  const category = await prisma.productCategory.create({
    data: { name: `${tag} Category`, productType: "STOCK_PRECAST" },
  });
  const product = await prisma.product.create({
    data: {
      productCode: `${tag}-P1`,
      name: `${tag} block`,
      categoryId: category.id,
      trackInventory: false,
    },
  });
  productId = product.id;
  const customer = await prisma.customer.create({ data: { name: customerName } });
  const job = await prisma.job.create({
    data: {
      jobNumber: `${tag}-JOB`,
      year: 2099,
      yearTwoDigit: 99,
      sequenceNumber: Number(stamp) + 3_000_000,
      customerId: customer.id,
      customerName,
      projectName: `${tag} project`,
      status: "AWARDED",
      folderPath: jobFolder,
    },
  });
  jobId = job.id;

  await createTicket("twoPage", 1, { jobId });
  await createTicket("onePage", 2);
  await createTicket("delivered", 3, {
    status: "DELIVERED",
    deliveredAt: addLocalDays(new Date(), -2),
    deliveryDate: addLocalDays(new Date(), -2),
  });
  await createTicket("cancelled", 4, { status: "CANCELLED" });
  await createTicket("handwritten", 5);
  await createTicket("neverBack", 6, {
    status: "DELIVERED",
    deliveredAt: addLocalDays(new Date(), -3),
    deliveryDate: addLocalDays(new Date(), -3),
  });
  await createTicket("stillLive", 7, { deliveryDate: addLocalDays(new Date(), -1) });
  await createTicket("toCancel", 8, { deliveryDate: addLocalDays(new Date(), -1) });
});

afterAll(async () => {
  await prisma.ticketScanBatch.deleteMany({});
  await prisma.invoice.deleteMany({ where: { customerName } });
  await prisma.deliveryTicket.deleteMany({ where: { customerName } });
  await prisma.jobFile.deleteMany({ where: { jobId } });
  await prisma.job.deleteMany({ where: { id: jobId } });
  await prisma.customer.deleteMany({ where: { name: customerName } });
  await prisma.inventoryTransaction.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { productCode: { startsWith: tag } } });
  await prisma.productCategory.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.$disconnect();
  delete process.env.PRECASTAPP_STORAGE_DIR;
  await rm(storageDir, { recursive: true, force: true });
  await rm(folders.jobsRoot, { recursive: true, force: true });
});

describe("Scan In", () => {
  let filedScanId: string;

  it("reads a dropped scan and sorts every page", async () => {
    const scan = await buildScan(
      [
        { code: codeFor(tickets.twoPage!, { page: 1, of: 2 }) },
        { code: codeFor(tickets.twoPage!, { page: 2, of: 2 }), turn: 180 },
        { code: codeFor(tickets.onePage!) },
        { blank: true },
        { code: codeFor(tickets.delivered!) },
        { code: codeFor(tickets.cancelled!) },
        { text: "Hand written carbon ticket, no code on it" },
        { code: codeFor(tickets.onePage!, { copy: 2 }) },
        { code: `LIP/ZS${stamp}99/1/1/1/ABC123` },
        { code: codeFor(tickets.handwritten!, { check: "WRONG1" }) },
      ],
      "morning-stack.pdf",
    );
    const view = await upload(scan);

    expect(view.open?.sources).toMatchObject([
      { fileName: "morning-stack.pdf", pageCount: 10, letter: "A" },
    ]);
    expect(view.open?.counts).toMatchObject({ pages: 10, codesRead: 8 });

    expect(rowFor(view, "1")).toMatchObject({
      kind: "ready",
      band: "ready",
      ticketNumber: tickets.twoPage!.ticketNumber,
      sheet: "1 of 2",
      copy: "Top",
      lead: true,
      deliver: true,
    });
    // Fed upside down: the row says so and the picture comes out upright.
    expect(rowFor(view, "2")).toMatchObject({ kind: "ready", sheet: "2 of 2" });
    expect(rowFor(view, "2").notes).toContain("Fed upside down, turned upright");
    expect(rowFor(view, "3")).toMatchObject({ kind: "ready", deliver: true });
    expect(rowFor(view, "4")).toMatchObject({ kind: "blank", band: "left" });
    // Already delivered: it files, with no Deliver box.
    expect(rowFor(view, "5")).toMatchObject({ kind: "ready", deliver: null });
    expect(rowFor(view, "6")).toMatchObject({ kind: "cancelled", band: "needs" });
    expect(rowFor(view, "7")).toMatchObject({
      kind: "notRead",
      band: "needs",
      // "Same Ticket As Above" offers the ticket of the page right above it.
      aboveTicketNumber: tickets.cancelled!.ticketNumber,
    });
    // A second copy of a page that is already in the scan is left out.
    expect(rowFor(view, "8")).toMatchObject({ kind: "extra", band: "left" });
    expect(rowFor(view, "9")).toMatchObject({ kind: "notHere", band: "needs" });
    // Same number, printed from another copy of the app: not filed.
    expect(rowFor(view, "10")).toMatchObject({ kind: "notHere", band: "needs" });
    expect(rowFor(view, "10").detail).toMatch(/another copy of the app/);

    expect(view.open?.counts).toMatchObject({
      ticketsToFile: 3,
      pagesToFile: 4,
      delivering: 2,
      needsYou: 4,
    });
    // Tickets whose paper is in the scan are not "still out".
    const out = view.stillOut.map((row) => row.ticketNumber);
    expect(out).not.toContain(tickets.twoPage!.ticketNumber);
    expect(out).toContain(tickets.neverBack!.ticketNumber);
    expect(out).toContain(tickets.stillLive!.ticketNumber);
  });

  it("takes a typed number, a skip, a second copy and a turn", async () => {
    let view = viewOf(await readTicketScanPages((await currentOpenId()), null));
    const batchId = view.open!.id;
    const seqOf = (pgLabel: string) => rowFor(view, pgLabel).seq;

    // Digits alone find the ticket.
    view = viewOf(
      await setTicketScanPageTicket(batchId, seqOf("7"), `${stamp}5`, "typed", null),
    );
    expect(rowFor(view, "7")).toMatchObject({
      kind: "ready",
      ticketNumber: tickets.handwritten!.ticketNumber,
      typed: true,
      sheet: "1 of 1",
    });
    expect(rowFor(view, "7").notes).toContain("Number typed by you");

    const wrong = await setTicketScanPageTicket(batchId, seqOf("9"), "ZS000", "typed", null);
    expect(wrong).toMatchObject({ error: "There is no ticket ZS000." });

    view = viewOf(await setTicketScanPageSkipped(batchId, seqOf("9"), true, null));
    view = viewOf(await setTicketScanPageSkipped(batchId, seqOf("10"), true, null));
    expect(rowFor(view, "9")).toMatchObject({ kind: "skipped", band: "left" });

    // "Use this copy": the second copy of the one-page ticket goes in instead.
    view = viewOf(await pickTicketScanPageCopy(batchId, seqOf("8"), null));
    expect(rowFor(view, "8")).toMatchObject({ kind: "ready", copy: "Second" });
    expect(rowFor(view, "3")).toMatchObject({ kind: "extra" });
    view = viewOf(await pickTicketScanPageCopy(batchId, seqOf("3"), null));
    expect(rowFor(view, "3")).toMatchObject({ kind: "ready", copy: "Top" });

    // A turn by hand sticks, and the picture address changes with it.
    const before = rowFor(view, "7").imageUrl;
    view = viewOf(await turnTicketScanPage(batchId, seqOf("7"), null));
    expect(rowFor(view, "7").imageUrl).not.toBe(before);
    for (let turn = 0; turn < 3; turn += 1) {
      view = viewOf(await turnTicketScanPage(batchId, seqOf("7"), null));
    }
    expect(rowFor(view, "7").imageUrl).toBe(before);

    // The cancelled ticket: leave its page out.
    view = viewOf(
      await setTicketScanChoice(
        batchId,
        tickets.cancelled!.ticketNumber,
        { cancelled: "skip" },
        null,
      ),
    );
    expect(rowFor(view, "6")).toMatchObject({ kind: "leftOut", band: "left" });

    // Untick Deliver on the one-page ticket.
    view = viewOf(
      await setTicketScanChoice(
        batchId,
        tickets.onePage!.ticketNumber,
        { deliver: false },
        null,
      ),
    );
    expect(rowFor(view, "3")).toMatchObject({ deliver: false });
    expect(view.open?.counts).toMatchObject({
      ticketsToFile: 4,
      pagesToFile: 5,
      delivering: 2,
      needsYou: 0,
    });
  });

  it("files: signed PDFs, deliveries, invoices, and the scan is gone", async () => {
    const before = viewOf(await readTicketScanPages(await currentOpenId(), null));
    const stale = await fileTicketScan(before.open!.id, before.open!.version - 1, null);
    expect(stale).toMatchObject({
      error: expect.stringMatching(/changed since this screen last loaded/),
    });

    const result = await fileTicketScan(before.open!.id, before.open!.version, null);
    const view = viewOf(result);
    expect("warning" in result ? result.warning : null).toBeNull();
    expect(view.open).toBeNull();
    expect(view.filed).not.toBeNull();
    filedScanId = view.filed!.id;
    expect(view.filed!.counts).toMatchObject({
      tickets: 4,
      pages: 5,
      markedDelivered: 2,
      invoicesMade: 2,
      jobFolderCopies: 1,
      leftOut: 5,
    });
    // Paper stack order.
    expect(view.filed!.tickets.map((ticket) => ticket.ticketNumber)).toEqual([
      tickets.twoPage!.ticketNumber,
      tickets.onePage!.ticketNumber,
      tickets.delivered!.ticketNumber,
      tickets.handwritten!.ticketNumber,
    ]);
    expect(view.rows.filter((row) => row.band === "filed")).toHaveLength(5);
    expect(view.rows.filter((row) => row.band === "left")).toHaveLength(5);
    expect(view.filed!.printInvoicesUrl).toContain(filedScanId);

    // The masters: one PDF per ticket, named by ticket number.
    const twoPage = await PDFDocument.load(
      await readFile(signedPath("2026", `${tickets.twoPage!.ticketNumber}.pdf`)),
    );
    expect(twoPage.getPageCount()).toBe(2);
    // The page fed upside down is stored turned upright.
    expect(twoPage.getPage(0).getRotation().angle).toBe(0);
    expect(twoPage.getPage(1).getRotation().angle).toBe(0);
    expect(
      await exists(signedPath("2026", `${tickets.handwritten!.ticketNumber}.pdf`)),
    ).toBe(true);
    // The cancelled ticket was left out: nothing filed for it.
    expect(
      await exists(signedPath("2026", `${tickets.cancelled!.ticketNumber}.pdf`)),
    ).toBe(false);

    // The copy in the job folder, listed on the job's files.
    const copy = path.join(
      jobFolder,
      "05 Delivery Tickets",
      `${tickets.twoPage!.ticketNumber} - Signed.pdf`,
    );
    expect(await exists(copy)).toBe(true);
    expect(
      await prisma.jobFile.count({ where: { jobId, filePath: copy } }),
    ).toBe(1);

    const twoPageRow = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: tickets.twoPage!.id },
      include: { invoice: true, signedFiles: true },
    });
    expect(twoPageRow.status).toBe("DELIVERED");
    expect(twoPageRow.paperTicketVerified).toBe(true);
    expect(twoPageRow.verifiedBy).toBe("Test User");
    expect(twoPageRow.invoice).not.toBeNull();
    expect(twoPageRow.signedFiles).toMatchObject([
      { isCurrent: true, pageCount: 2, batchId: filedScanId, jobFolderCopyPath: copy },
    ]);

    // Deliver was unticked: signed copy filed, ticket left as it was.
    const onePageRow = await prisma.deliveryTicket.findUniqueOrThrow({
      where: { id: tickets.onePage!.id },
      include: { invoice: true },
    });
    expect(onePageRow.status).toBe("SCHEDULED");
    expect(onePageRow.invoice).toBeNull();
    expect(onePageRow.paperTicketVerified).toBe(true);

    // The uploaded stack is deleted once everything in it is dealt with.
    expect(await prisma.ticketScanBatch.count({ where: { status: "OPEN" } })).toBe(0);
    expect(await readdir(path.join(storageDir, "ticket-scans"))).toEqual([]);

    // Still Out: the signed-but-not-delivered ticket is listed, saying so.
    const stillOut = view.stillOut.find(
      (row) => row.ticketNumber === tickets.onePage!.ticketNumber,
    );
    expect(stillOut).toMatchObject({ signedNotDelivered: true });
    expect(
      view.stillOut.map((row) => row.ticketNumber),
    ).not.toContain(tickets.twoPage!.ticketNumber);
  });

  it("asks before replacing a signed copy, and keeps the earlier one", async () => {
    const rescan = await buildScan(
      [
        { code: codeFor(tickets.twoPage!, { page: 1, of: 2 }) },
        { code: codeFor(tickets.onePage!, { page: 1, of: 2 }) },
      ],
      "rescan.pdf",
    );
    let view = await upload(rescan);
    const batchId = view.open!.id;
    expect(rowFor(view, "1")).toMatchObject({ kind: "already", band: "needs" });
    expect(rowFor(view, "1").onFileUrl).toContain("/api/signed-tickets/");
    expect(view.open!.counts.ticketsToFile).toBe(0);

    // Replace, and file it although its second page is not in this scan.
    view = viewOf(
      await setTicketScanChoice(
        batchId,
        tickets.twoPage!.ticketNumber,
        { already: "replace" },
        null,
      ),
    );
    expect(rowFor(view, "1")).toMatchObject({ kind: "missing", detail: "Page 2 missing" });
    view = viewOf(
      await setTicketScanChoice(
        batchId,
        tickets.twoPage!.ticketNumber,
        { missing: "file" },
        null,
      ),
    );
    expect(rowFor(view, "1")).toMatchObject({ kind: "ready", decided: true });
    expect(rowFor(view, "1").notes.join(" ")).toMatch(/Replaces the copy scanned/);
    // The other ticket keeps waiting: Skip it for now.
    view = viewOf(
      await setTicketScanChoice(
        batchId,
        tickets.onePage!.ticketNumber,
        { already: "skip" },
        null,
      ),
    );

    view = viewOf(await fileTicketScan(batchId, view.open!.version, null));
    expect(view.open).toBeNull();
    expect(view.filed!.tickets).toMatchObject([
      { ticketNumber: tickets.twoPage!.ticketNumber, replaced: true, pageCount: 1 },
    ]);

    const files = await prisma.signedTicketFile.findMany({
      where: { deliveryTicketId: tickets.twoPage!.id },
      orderBy: { createdAt: "asc" },
    });
    expect(files).toMatchObject([
      {
        isCurrent: false,
        pageCount: 2,
        filePath: `2026/${tickets.twoPage!.ticketNumber} (earlier version 1).pdf`,
      },
      {
        isCurrent: true,
        pageCount: 1,
        filePath: `2026/${tickets.twoPage!.ticketNumber}.pdf`,
      },
    ]);
    const earlier = await PDFDocument.load(
      await readFile(
        signedPath("2026", `${tickets.twoPage!.ticketNumber} (earlier version 1).pdf`),
      ),
    );
    expect(earlier.getPageCount()).toBe(2);
    // Still one current copy for the skipped ticket, untouched.
    expect(
      await prisma.signedTicketFile.count({
        where: { deliveryTicketId: tickets.onePage!.id },
      }),
    ).toBe(1);
  });

  it("removes a scan without filing anything", async () => {
    const scan = await buildScan([{ text: "Wrong file" }], "wrong.pdf");
    const view = await upload(scan);
    const cleared = viewOf(await discardTicketScan(view.open!.id, null));
    expect(cleared.open).toBeNull();
    expect(await readdir(path.join(storageDir, "ticket-scans"))).toEqual([]);
  });

  it("refuses a file that is not a PDF", async () => {
    const formData = new FormData();
    formData.append(
      "files",
      new File(["not a pdf at all"], "notes.pdf", { type: "application/pdf" }),
    );
    const result = await uploadTicketScans(formData);
    expect(result).toMatchObject({ error: expect.stringMatching(/not a PDF/) });
    expect(await prisma.ticketScanBatch.count({ where: { status: "OPEN" } })).toBe(0);
  });

  it("draws a filed page as a picture", async () => {
    const bytes = await readFile(
      signedPath("2026", `${tickets.handwritten!.ticketNumber}.pdf`),
    );
    const image = await renderPdfPageImage(bytes, 1);
    expect(image.pageCount).toBe(1);
    // JPEG magic bytes.
    expect([...image.bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  describe("Still Out", () => {
    it("closes a delivered ticket with no signed copy, and takes that back", async () => {
      const closed = await closeStillOutTicketAction(tickets.neverBack!.id, null);
      const view = viewOf(closed);
      expect(view.stillOut.map((row) => row.ticketNumber)).not.toContain(
        tickets.neverBack!.ticketNumber,
      );
      expect("undo" in closed ? closed.undo : null).toMatchObject({
        kind: "closed",
        wasMarkedDelivered: false,
      });
      const row = await prisma.deliveryTicket.findUniqueOrThrow({
        where: { id: tickets.neverBack!.id },
      });
      expect(row.closedWithoutSignedCopyBy).toBe("Test User");

      const reopened = viewOf(
        await reopenStillOutTicketAction(
          tickets.neverBack!.id,
          { undoDelivery: false, removeUnpaidInvoice: false },
          null,
        ),
      );
      expect(reopened.stillOut.map((entry) => entry.ticketNumber)).toContain(
        tickets.neverBack!.ticketNumber,
      );
    });

    it("marks a live ticket delivered with no signed copy; undo asks about the invoice", async () => {
      const closed = await closeStillOutTicketAction(tickets.stillLive!.id, null);
      viewOf(closed);
      expect("undo" in closed ? closed.undo : null).toMatchObject({
        kind: "closed",
        wasMarkedDelivered: true,
        invoiceNumber: expect.any(String),
      });
      const delivered = await prisma.deliveryTicket.findUniqueOrThrow({
        where: { id: tickets.stillLive!.id },
        include: { invoice: true },
      });
      expect(delivered.status).toBe("DELIVERED");
      expect(delivered.invoice).not.toBeNull();
      expect(delivered.closedWithoutSignedCopyAt).not.toBeNull();

      // Without the yes, the undo is refused and says which invoice is at stake.
      const refused = await reopenStillOutTicketAction(
        tickets.stillLive!.id,
        { undoDelivery: true, removeUnpaidInvoice: false },
        null,
      );
      expect(refused).toMatchObject({
        needsInvoiceRemoval: { invoiceNumber: delivered.invoice!.invoiceNumber },
      });

      const view = viewOf(
        await reopenStillOutTicketAction(
          tickets.stillLive!.id,
          { undoDelivery: true, removeUnpaidInvoice: true },
          null,
        ),
      );
      const back = await prisma.deliveryTicket.findUniqueOrThrow({
        where: { id: tickets.stillLive!.id },
        include: { invoice: true },
      });
      expect(back.status).toBe("SCHEDULED");
      expect(back.invoice).toBeNull();
      expect(back.closedWithoutSignedCopyAt).toBeNull();
      expect(view.stillOut.map((row) => row.ticketNumber)).toContain(
        tickets.stillLive!.ticketNumber,
      );
    });

    it("moves a date and moves it back", async () => {
      const yesterday = toLocalDayInput(addLocalDays(new Date(), -1));
      const nextWeek = toLocalDayInput(addLocalDays(new Date(), 7));
      const moved = await moveStillOutTicketDateAction(
        tickets.stillLive!.id,
        nextWeek,
        null,
      );
      // Scheduled for next week: not out yet.
      expect(viewOf(moved).stillOut.map((row) => row.ticketNumber)).not.toContain(
        tickets.stillLive!.ticketNumber,
      );
      expect("undo" in moved ? moved.undo : null).toEqual({
        kind: "moved",
        ticketId: tickets.stillLive!.id,
        previousDate: yesterday,
      });
      const back = viewOf(
        await restoreStillOutTicketDateAction(tickets.stillLive!.id, yesterday, null),
      );
      expect(back.stillOut.map((row) => row.ticketNumber)).toContain(
        tickets.stillLive!.ticketNumber,
      );
    });

    it("cancels a ticket that never went out", async () => {
      const view = viewOf(
        await cancelStillOutTicketAction(tickets.toCancel!.id, null),
      );
      expect(view.stillOut.map((row) => row.ticketNumber)).not.toContain(
        tickets.toCancel!.ticketNumber,
      );
      const row = await prisma.deliveryTicket.findUniqueOrThrow({
        where: { id: tickets.toCancel!.id },
      });
      expect(row.status).toBe("CANCELLED");
    });
  });
});

async function currentOpenId(): Promise<string> {
  const open = await prisma.ticketScanBatch.findFirstOrThrow({
    where: { status: "OPEN" },
    select: { id: true },
  });
  return open.id;
}
