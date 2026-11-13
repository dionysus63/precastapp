import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/app/generated/prisma/client";

/**
 * Dropping a scan: a PDF that will not open is told apart from a reader that
 * is not working on the server, so nobody is sent back to the copier for a
 * fault that is not in the scan.
 */

const countPdfPages = vi.fn<(bytes: Uint8Array) => Promise<number>>();
const scanReaderFault = vi.fn<() => Promise<{ error: unknown } | null>>();

vi.mock("@/lib/ticket-scan/reader", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ticket-scan/reader")>()),
  countPdfPages: (bytes: Uint8Array) => countPdfPages(bytes),
  scanReaderFault: () => scanReaderFault(),
}));

const { addScanFiles, ScanInError } = await import("@/lib/ticket-scan/service");

/** Every file here is turned away before the database is asked anything. */
const noDatabase = {} as PrismaClient;

async function scanPdf(name: string): Promise<File> {
  const document = await PDFDocument.create();
  document.addPage([612, 792]);
  const bytes = await document.save();
  return new File([Buffer.from(bytes)], name, { type: "application/pdf" });
}

beforeEach(() => {
  countPdfPages.mockReset();
  scanReaderFault.mockReset();
});

describe("a dropped scan that will not open", () => {
  it("blames the reader on the server when its own test page fails too", async () => {
    const fault = new Error(
      'Invalid factory url: "C:\\Apps\\wasm\\" must include trailing slash.',
    );
    countPdfPages.mockRejectedValue(fault);
    scanReaderFault.mockResolvedValue({ error: fault });

    const attempt = addScanFiles(noDatabase, [await scanPdf("DOC_1.pdf")], null);
    await expect(attempt).rejects.toBeInstanceOf(ScanInError);
    await expect(attempt).rejects.toThrow(
      /DOC_1\.pdf: the scan reader on this server is not working \(it could not open its own test page either\), so scanning this again will not help/,
    );
    await expect(attempt).rejects.toThrow(/Detail: Invalid factory url/);
  });

  it("blames the PDF when the reader opens its test page", async () => {
    countPdfPages.mockRejectedValue(new Error("Invalid PDF structure."));
    scanReaderFault.mockResolvedValue(null);

    await expect(
      addScanFiles(noDatabase, [await scanPdf("torn.pdf")], null),
    ).rejects.toThrow(
      /^torn\.pdf: this PDF could not be opened \(it may be damaged or password protected\)\.$/,
    );
    expect(scanReaderFault).toHaveBeenCalledTimes(1);
  });

  it("does not test the reader for a file that is plainly not a PDF", async () => {
    const photo = new File([Buffer.from("JFIF, not a PDF at all")], "photo.pdf", {
      type: "application/pdf",
    });
    await expect(addScanFiles(noDatabase, [photo], null)).rejects.toThrow(
      /photo\.pdf: this is not a PDF/,
    );
    expect(countPdfPages).not.toHaveBeenCalled();
    expect(scanReaderFault).not.toHaveBeenCalled();
  });
});
