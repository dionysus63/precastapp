import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  countPdfPages,
  nodeMajorVersion,
  pdfJsFolderUrl,
  scanReaderFault,
  scanReaderProblem,
} from "@/lib/ticket-scan/reader";

/**
 * The parts of the scan reader that depend on the machine it runs on: the
 * server is a Windows PC, and these tests run anywhere.
 */

describe("the folders handed to pdf.js", () => {
  it("writes a Windows folder with forward slashes and ends it with one", () => {
    expect(
      pdfJsFolderUrl("C:\\Apps\\precastapp\\node_modules\\pdfjs-dist\\wasm", "\\"),
    ).toBe("C:/Apps/precastapp/node_modules/pdfjs-dist/wasm/");
    expect(
      pdfJsFolderUrl("\\\\LIP-TITAN\\apps\\node_modules\\pdfjs-dist\\cmaps\\", "\\"),
    ).toBe("//LIP-TITAN/apps/node_modules/pdfjs-dist/cmaps/");
  });

  it("only adds the ending slash on other systems", () => {
    expect(pdfJsFolderUrl("/srv/app/node_modules/pdfjs-dist/wasm", "/")).toBe(
      "/srv/app/node_modules/pdfjs-dist/wasm/",
    );
    expect(pdfJsFolderUrl("/srv/app/node_modules/pdfjs-dist/wasm/", "/")).toBe(
      "/srv/app/node_modules/pdfjs-dist/wasm/",
    );
  });

  it("is a folder pdf.js accepts, where the Windows spelling is refused", async () => {
    const blank = await PDFDocument.create();
    blank.addPage([612, 792]);
    const bytes = await blank.save();
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const windowsFolder = "C:\\Apps\\precastapp\\node_modules\\pdfjs-dist\\wasm";

    // What the reader used to hand over on Windows: the folder plus "\".
    expect(() =>
      pdfjs.getDocument({
        data: new Uint8Array(bytes),
        wasmUrl: `${windowsFolder}\\`,
      }),
    ).toThrow(/trailing slash/i);

    const folder = pdfJsFolderUrl(windowsFolder, "\\");
    const document = await pdfjs.getDocument({
      data: new Uint8Array(bytes),
      verbosity: 0,
      standardFontDataUrl: folder,
      cMapUrl: folder,
      wasmUrl: folder,
      iccUrl: folder,
    }).promise;
    try {
      expect(document.numPages).toBe(1);
    } finally {
      await document.loadingTask.destroy();
    }
  });
});

describe("what the screen says when the reader itself fails", () => {
  it("reads the Node.js major version", () => {
    expect(nodeMajorVersion("22.13.0")).toBe(22);
    expect(nodeMajorVersion("20.19.5")).toBe(20);
    expect(nodeMajorVersion("")).toBe(0);
    expect(nodeMajorVersion()).toBeGreaterThanOrEqual(20);
  });

  it("blames the server, not the scan, and keeps the technical detail", () => {
    const message = scanReaderProblem(
      new Error('Invalid factory url: "C:\\x\\wasm\\"\n  must include trailing slash.'),
      "22.13.0",
    );
    expect(message).toMatch(/scan reader on this server is not working/);
    expect(message).toMatch(/scanning this again will not help/);
    expect(message).toMatch(/Detail: Invalid factory url: "C:\\x\\wasm\\" must include trailing slash\./);
    expect(message).not.toMatch(/Node\.js/);
  });

  it("names an old Node.js as the likely cause", () => {
    const message = scanReaderProblem(
      new TypeError("Promise.withResolvers is not a function"),
      "20.11.1",
    );
    expect(message).toMatch(
      /This server runs Node\.js 20\.11\.1, and the reader is built for Node\.js 22 or newer\./,
    );
  });

  it("finds no fault with a reader that works, and opens a real PDF", async () => {
    expect(await scanReaderFault()).toBeNull();
    const twoPages = await PDFDocument.create();
    twoPages.addPage([612, 792]);
    twoPages.addPage([612, 792]);
    expect(await countPdfPages(await twoPages.save())).toBe(2);
    await expect(
      countPdfPages(new TextEncoder().encode("%PDF-1.7 and then nothing useful")),
    ).rejects.toThrow();
  });

  it("keeps a very long detail short and copes with no error object", () => {
    expect(scanReaderProblem(new Error("x".repeat(2000)), "22.13.0").length).toBeLessThan(520);
    expect(scanReaderProblem(undefined, "22.13.0")).toMatch(/Detail: no detail was given/);
  });
});
