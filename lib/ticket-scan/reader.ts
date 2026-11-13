import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { parseTicketScanCode } from "@/lib/ticket-scan-code";
import {
  normalizeScanRotation,
  type ScanBox,
  type ScanPageCode,
  type ScanRotation,
} from "@/lib/ticket-scan/types";

/**
 * Reads scanned ticket pages on the server: draws each PDF page to a canvas
 * (pdf.js + @napi-rs/canvas), then looks for the ticket's QR code in the
 * picture (zxing). No paid service and nothing leaves the building.
 *
 * pdf.js, the canvas and zxing are loaded from node_modules at run time
 * (see serverExternalPackages in next.config.ts): pdf.js finds its own worker
 * and its canvas relative to its files, which a bundle breaks.
 */

/** Scans read 80 of 80 at this size in the step 1 tests (150–300 dpi originals). */
const READ_DPI = 150;
/** Second try for a page with no code found: more pixels on a faint or small code. */
const RETRY_DPI = 240;
/** Screen previews: sharp enough to read a signature, small enough to load at once. */
const PREVIEW_DPI = 110;
const PREVIEW_JPEG_QUALITY = 78;
/** Never draw a page bigger than this many pixels on its long side. */
const MAX_RENDER_SIDE = 3600;

/** A page counts as printed-on above this share of dark pixels. */
const BLANK_INK_SHARE = 0.0004;
const BLANK_DARK_LUMA = 140;
/** Scanner shadows live at the edges: leave this share of each side out. */
const BLANK_EDGE_SHARE = 0.04;

export const NO_CODE_NOTE = "No code found on this page";
export const NOT_A_TICKET_CODE_NOTE =
  "A code was found, but it is not a ticket code";
export const UNREADABLE_PAGE_NOTE = "This page could not be opened";

export type ScanPageRead = {
  blank: boolean;
  code: ScanPageCode | null;
  codeBox: ScanBox | null;
  rotation: ScanRotation;
  readNote: string | null;
};

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDocument = Awaited<ReturnType<PdfJsModule["getDocument"]>["promise"]>;
type CanvasModule = typeof import("@napi-rs/canvas");
type ZxingModule = typeof import("zxing-wasm/reader");

let pdfJsPromise: Promise<PdfJsModule> | null = null;
let canvasPromise: Promise<CanvasModule> | null = null;
let zxingPromise: Promise<ZxingModule> | null = null;

function packagePath(...parts: string[]): string {
  return path.join(process.cwd(), "node_modules", ...parts);
}

/**
 * A folder the way pdf.js wants it. pdf.js reads these folders with fs in
 * Node, and refuses one that does not end in a forward slash, on Windows too,
 * where the path itself is written with backslashes. Windows opens a path
 * written with forward slashes just the same, so every separator becomes one.
 */
export function pdfJsFolderUrl(
  folder: string,
  separator: string = path.sep,
): string {
  const forward =
    separator === "/" ? folder : folder.split(separator).join("/");
  return forward.endsWith("/") ? forward : `${forward}/`;
}

function pdfJsAssetDir(name: string): string {
  return pdfJsFolderUrl(packagePath("pdfjs-dist", name));
}

/**
 * pdf.js asks for Node.js 22.13 or newer. The one thing it is known to miss
 * on Node.js 20 is Promise.withResolvers (standard since 2024), so that is
 * filled in here when the server's Node.js does not have it.
 */
function fillInPromiseWithResolvers(): void {
  const holder = Promise as unknown as { withResolvers?: unknown };
  if (typeof holder.withResolvers === "function") {
    return;
  }
  holder.withResolvers = function withResolvers<T>(
    this: PromiseConstructor,
  ): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  } {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new this<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

/** The Node.js major version this server runs, for a hint when the reader fails. */
export function nodeMajorVersion(version: string = process.versions.node): number {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  return Number.isFinite(major) ? major : 0;
}

/** pdf.js is built and tested for this Node.js major version and up. */
export const SCAN_READER_NODE_MAJOR = 22;

/**
 * Words for the person at the screen when the reader cannot open even its
 * own test page (see `scanReaderFault`): the fault is on the server, not in
 * the scan, so they are not sent back to the copier.
 */
export function scanReaderProblem(
  error: unknown,
  nodeVersion: string = process.versions.node,
): string {
  const detail =
    error instanceof Error && error.message
      ? error.message.replace(/\s+/g, " ").trim().slice(0, 240)
      : "no detail was given";
  const nodeHint =
    nodeMajorVersion(nodeVersion) < SCAN_READER_NODE_MAJOR
      ? ` This server runs Node.js ${nodeVersion}, and the reader is built for Node.js ${SCAN_READER_NODE_MAJOR} or newer.`
      : "";
  return `the scan reader on this server is not working (it could not open its own test page either), so scanning this again will not help. The reader needs looking at on the server.${nodeHint} Detail: ${detail}`;
}

async function loadCanvas(): Promise<CanvasModule> {
  canvasPromise ??= import("@napi-rs/canvas");
  return canvasPromise;
}

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = (async () => {
      fillInPromiseWithResolvers();
      // pdf.js draws through @napi-rs/canvas in Node; load it first so a
      // missing native build fails here with its own message.
      await loadCanvas();
      return import("pdfjs-dist/legacy/build/pdf.mjs");
    })();
    pdfJsPromise.catch(() => {
      pdfJsPromise = null;
    });
  }
  return pdfJsPromise;
}

async function loadZxing(): Promise<ZxingModule> {
  if (!zxingPromise) {
    zxingPromise = (async () => {
      const zxing = await import("zxing-wasm/reader");
      // The reader's WebAssembly comes off this server's disk, never a CDN.
      const wasm = await readFile(
        packagePath("zxing-wasm", "dist", "reader", "zxing_reader.wasm"),
      );
      zxing.prepareZXingModule({
        overrides: {
          wasmBinary: wasm.buffer.slice(
            wasm.byteOffset,
            wasm.byteOffset + wasm.byteLength,
          ) as ArrayBuffer,
        },
      });
      return zxing;
    })();
    zxingPromise.catch(() => {
      zxingPromise = null;
    });
  }
  return zxingPromise;
}

async function openPdf(bytes: Uint8Array): Promise<PdfDocument> {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({
    // pdf.js takes over the buffer it is given: hand it a copy.
    data: new Uint8Array(bytes),
    verbosity: 0,
    standardFontDataUrl: pdfJsAssetDir("standard_fonts"),
    cMapUrl: pdfJsAssetDir("cmaps"),
    cMapPacked: true,
    wasmUrl: pdfJsAssetDir("wasm"),
    iccUrl: pdfJsAssetDir("iccs"),
    useSystemFonts: false,
  }).promise;
}

type RenderedPage = {
  canvas: import("@napi-rs/canvas").Canvas;
  width: number;
  height: number;
};

async function renderPage(
  document: PdfDocument,
  pageNumber: number,
  dpi: number,
  extraRotation: ScanRotation = 0,
): Promise<RenderedPage> {
  const { createCanvas } = await loadCanvas();
  const page = await document.getPage(pageNumber);
  try {
    const rotation = (page.rotate + extraRotation) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    const scale = Math.min(
      dpi / 72,
      MAX_RENDER_SIDE / Math.max(base.width, base.height),
    );
    const viewport = page.getViewport({ scale, rotation });
    const width = Math.max(1, Math.ceil(viewport.width));
    const height = Math.max(1, Math.ceil(viewport.height));
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    await page.render({
      // pdf.js types expect the browser's canvas; the Node one draws the same.
      canvasContext: context as unknown as CanvasRenderingContext2D,
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;
    return { canvas, width, height };
  } finally {
    page.cleanup();
  }
}

/** Share of dark pixels away from the edges: tells a blank back from a page. */
function inkShare(data: Uint8ClampedArray, width: number, height: number): number {
  const left = Math.floor(width * BLANK_EDGE_SHARE);
  const right = Math.ceil(width * (1 - BLANK_EDGE_SHARE));
  const top = Math.floor(height * BLANK_EDGE_SHARE);
  const bottom = Math.ceil(height * (1 - BLANK_EDGE_SHARE));
  // Every third pixel each way is plenty for a share.
  const step = 3;
  let dark = 0;
  let seen = 0;
  for (let y = top; y < bottom; y += step) {
    for (let x = left; x < right; x += step) {
      const at = (y * width + x) * 4;
      const luma =
        0.299 * data[at]! + 0.587 * data[at + 1]! + 0.114 * data[at + 2]!;
      if (luma < BLANK_DARK_LUMA) {
        dark += 1;
      }
      seen += 1;
    }
  }
  return seen === 0 ? 0 : dark / seen;
}

type CodeHit = {
  code: ScanPageCode;
  box: ScanBox;
  rotation: ScanRotation;
};

type CodeSearch = { hit: CodeHit | null; sawOtherCode: boolean };

async function findTicketCode(rendered: RenderedPage): Promise<CodeSearch> {
  const zxing = await loadZxing();
  const { canvas, width, height } = rendered;
  const image = canvas.getContext("2d").getImageData(0, 0, width, height);
  const results = await zxing.readBarcodes(image as unknown as ImageData, {
    formats: ["QRCode"],
    tryHarder: true,
    tryRotate: true,
    tryDownscale: true,
    maxNumberOfSymbols: 4,
  });
  let sawOtherCode = false;
  for (const result of results) {
    if (!result.isValid) {
      continue;
    }
    const code = parseTicketScanCode(result.text);
    if (!code) {
      sawOtherCode = true;
      continue;
    }
    const corners = [
      result.position.topLeft,
      result.position.topRight,
      result.position.bottomRight,
      result.position.bottomLeft,
    ];
    const xs = corners.map((corner) => corner.x);
    const ys = corners.map((corner) => corner.y);
    const minX = Math.max(0, Math.min(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxX = Math.min(width, Math.max(...xs));
    const maxY = Math.min(height, Math.max(...ys));
    return {
      hit: {
        code,
        box: {
          left: minX / width,
          top: minY / height,
          width: (maxX - minX) / width,
          height: (maxY - minY) / height,
        },
        // The code prints upright on the ticket, so however far the reader
        // found it turned is how far the page is turned: turn it back.
        rotation: normalizeScanRotation(-result.rotation),
      },
      sawOtherCode,
    };
  }
  return { hit: null, sawOtherCode };
}

function emptyRead(readNote: string | null, blank = false): ScanPageRead {
  return { blank, code: null, codeBox: null, rotation: 0, readNote };
}

/**
 * Reads the given pages (1-based) of an uploaded scan. A page that cannot be
 * drawn comes back "not read" with a note; the others are still read.
 */
export async function readScanPages(
  pdfBytes: Uint8Array,
  pageNumbers: number[],
): Promise<Map<number, ScanPageRead>> {
  const reads = new Map<number, ScanPageRead>();
  const document = await openPdf(pdfBytes);
  try {
    for (const pageNumber of pageNumbers) {
      if (pageNumber < 1 || pageNumber > document.numPages) {
        reads.set(pageNumber, emptyRead(UNREADABLE_PAGE_NOTE));
        continue;
      }
      try {
        const rendered = await renderPage(document, pageNumber, READ_DPI);
        let search = await findTicketCode(rendered);
        if (!search.hit) {
          const image = rendered.canvas
            .getContext("2d")
            .getImageData(0, 0, rendered.width, rendered.height);
          const share = inkShare(image.data, rendered.width, rendered.height);
          if (share < BLANK_INK_SHARE) {
            reads.set(pageNumber, emptyRead(null, true));
            continue;
          }
          const retry = await findTicketCode(
            await renderPage(document, pageNumber, RETRY_DPI),
          );
          search = {
            hit: retry.hit,
            sawOtherCode: search.sawOtherCode || retry.sawOtherCode,
          };
        }
        if (!search.hit) {
          reads.set(
            pageNumber,
            emptyRead(search.sawOtherCode ? NOT_A_TICKET_CODE_NOTE : NO_CODE_NOTE),
          );
          continue;
        }
        reads.set(pageNumber, {
          blank: false,
          code: search.hit.code,
          codeBox: search.hit.box,
          rotation: search.hit.rotation,
          readNote: null,
        });
      } catch (error) {
        console.error(`[ticket scan] page ${pageNumber} could not be read`, error);
        reads.set(pageNumber, emptyRead(UNREADABLE_PAGE_NOTE));
      }
    }
  } finally {
    await document.loadingTask.destroy().catch(() => undefined);
  }
  return reads;
}

export type PdfPageImage = {
  bytes: Buffer;
  pageCount: number;
  width: number;
  height: number;
};

/**
 * One page of any PDF as a JPEG for the screen (a scanned page, a filed
 * signed ticket, an invoice), turned upright by `rotation`.
 */
export async function renderPdfPageImage(
  pdfBytes: Uint8Array,
  pageNumber: number,
  options: { rotation?: ScanRotation; dpi?: number } = {},
): Promise<PdfPageImage> {
  const document = await openPdf(pdfBytes);
  try {
    const pageCount = document.numPages;
    if (pageNumber < 1 || pageNumber > pageCount) {
      throw new Error(`This PDF has no page ${pageNumber}.`);
    }
    const rendered = await renderPage(
      document,
      pageNumber,
      options.dpi ?? PREVIEW_DPI,
      options.rotation ?? 0,
    );
    const bytes = await rendered.canvas.encode("jpeg", PREVIEW_JPEG_QUALITY);
    return { bytes, pageCount, width: rendered.width, height: rendered.height };
  } finally {
    await document.loadingTask.destroy().catch(() => undefined);
  }
}

/** Page count of a PDF as pdf.js sees it (what the reader will be asked for). */
export async function countPdfPages(pdfBytes: Uint8Array): Promise<number> {
  const document = await openPdf(pdfBytes);
  try {
    return document.numPages;
  } finally {
    await document.loadingTask.destroy().catch(() => undefined);
  }
}

/**
 * Asked when a dropped PDF will not open: is it that PDF, or the reader?
 * Opens a one-page PDF made on the spot, which any working reader can. Comes
 * back null when the reader works (so the dropped PDF is the problem), or
 * with what went wrong.
 */
export async function scanReaderFault(): Promise<{ error: unknown } | null> {
  try {
    const testPage = await PDFDocument.create();
    testPage.addPage([612, 792]);
    const pages = await countPdfPages(await testPage.save());
    return pages === 1
      ? null
      : { error: new Error(`The test page came back as ${pages} pages.`) };
  } catch (error) {
    return { error };
  }
}
