/**
 * Scan In self-check: proves the scan reader works on THIS machine.
 *
 *   npm run check:scan-reader
 *   npm run check:scan-reader -- "C:\path\to\a scan.pdf"
 *
 * It makes a sample ticket page with its scan code, reads it back the way
 * Scan In does (pdf.js, the canvas and the code reader), draws the preview
 * picture, and files a test signed ticket in a scratch folder under the
 * system's temp folder. With a PDF named, it also reads every page of that
 * scan and says which ticket it found on each.
 *
 * It does not open the database and does not touch the app's storage
 * folder. Exit code 0 when everything passed, 1 when anything failed.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { buildQrModulePath } from "../lib/delivery-ticket-pdf-scan-code";
import { buildTicketScanCode } from "../lib/ticket-scan-code";
import {
  countPdfPages,
  nodeMajorVersion,
  readScanPages,
  renderPdfPageImage,
  SCAN_READER_NODE_MAJOR,
  scanReaderFault,
} from "../lib/ticket-scan/reader";
import {
  deleteScanFolder,
  readScanSource,
  readSignedTicket,
  removeSignedTicket,
  setAsideSignedTicket,
  writeScanSource,
  writeSignedTicket,
} from "../lib/ticket-scan/storage";

let passed = 0;
let failed = 0;

function ok(text: string): void {
  passed += 1;
  console.log(`[OK]   ${text}`);
}

function fail(text: string, error?: unknown): void {
  failed += 1;
  const detail =
    error instanceof Error ? `: ${error.message}` : error ? `: ${String(error)}` : "";
  console.log(`[FAIL] ${text}${detail}`);
}

function expectThat(condition: boolean, text: string, detail?: string): void {
  if (condition) {
    ok(text);
  } else {
    fail(detail ? `${text} (${detail})` : text);
  }
}

const SAMPLE_TICKET = "T90001";
const SAMPLE_CHECK = "SELFCK";

/** Three pages: a ticket, the same ticket fed upside down, and a blank back. */
async function buildSampleScan(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const turn of [0, 180] as const) {
    const page = document.addPage([612, 792]);
    page.drawText("DELIVERY TICKET (scan reader self-check)", {
      x: 60,
      y: 720,
      size: 14,
      font,
    });
    const code = buildTicketScanCode({
      ticketNumber: SAMPLE_TICKET,
      copyNumber: 1,
      pageNumber: 1,
      pageCount: 1,
      check: SAMPLE_CHECK,
    });
    const { path: qrPath, size } = buildQrModulePath(code);
    page.drawSvgPath(qrPath, {
      x: 525.5,
      y: 86,
      scale: 50 / size,
      color: rgb(0, 0, 0),
      borderWidth: 0,
    });
    if (turn) {
      page.setRotation(degrees(turn));
    }
  }
  document.addPage([612, 792]);
  return document.save();
}

async function checkReader(): Promise<void> {
  const fault = await scanReaderFault();
  if (fault) {
    fail("The reader opens its own test page", fault.error);
    return;
  }
  ok("The reader opens its own test page (pdf.js and the canvas load)");

  const scan = await buildSampleScan();
  const pageCount = await countPdfPages(scan);
  expectThat(pageCount === 3, "The sample scan has 3 pages", `saw ${pageCount}`);

  const started = Date.now();
  const reads = await readScanPages(scan, [1, 2, 3]);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  const upright = reads.get(1);
  expectThat(
    upright?.code?.ticketNumber === SAMPLE_TICKET && upright.rotation === 0,
    `Page 1: the code reads ${SAMPLE_TICKET}, upright`,
    upright?.code
      ? `saw ${upright.code.ticketNumber}, turned ${upright.rotation}`
      : (upright?.readNote ?? "nothing read"),
  );
  const flipped = reads.get(2);
  expectThat(
    flipped?.code?.ticketNumber === SAMPLE_TICKET,
    `Page 2: the code reads ${SAMPLE_TICKET} on a page fed upside down`,
    flipped?.code
      ? `saw ${flipped.code.ticketNumber}`
      : (flipped?.readNote ?? "nothing read"),
  );
  expectThat(
    reads.get(3)?.blank === true,
    "Page 3: a blank back is seen as blank",
    reads.get(3)?.readNote ?? undefined,
  );
  console.log(`       (3 pages read in ${seconds} s)`);

  const picture = await renderPdfPageImage(scan, 1);
  expectThat(
    picture.bytes.length > 2000 &&
      picture.bytes[0] === 0xff &&
      picture.bytes[1] === 0xd8 &&
      picture.width > 0 &&
      picture.height > 0,
    `The page preview is drawn (${picture.width} x ${picture.height}, ${picture.bytes.length.toLocaleString()} bytes)`,
  );
}

async function checkStorage(): Promise<void> {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "scan-reader-check-"));
  const before = process.env.PRECASTAPP_STORAGE_DIR;
  process.env.PRECASTAPP_STORAGE_DIR = scratch;
  const bytes = (text: string) => new TextEncoder().encode(text);
  try {
    await writeScanSource("selfcheck", "upload-1", bytes("uploaded scan"));
    const upload = await readScanSource("selfcheck", "upload-1");
    await deleteScanFolder("selfcheck");
    expectThat(
      upload.toString() === "uploaded scan",
      "An uploaded scan is saved, read back and removed",
    );

    await writeSignedTicket(`2026/${SAMPLE_TICKET}.pdf`, bytes("first signed copy"));
    const setAside = await setAsideSignedTicket(`2026/${SAMPLE_TICKET}.pdf`);
    await writeSignedTicket(`2026/${SAMPLE_TICKET}.pdf`, bytes("second signed copy"));
    const current = await readSignedTicket(`2026/${SAMPLE_TICKET}.pdf`);
    const earlier = setAside ? await readSignedTicket(setAside) : null;
    expectThat(
      setAside === `2026/${SAMPLE_TICKET} (earlier version 1).pdf` &&
        current.toString() === "second signed copy" &&
        earlier?.toString() === "first signed copy",
      "A signed ticket is filed, and a replaced copy is kept as an earlier version",
      `set aside as ${setAside ?? "nothing"}`,
    );
    await removeSignedTicket(`2026/${SAMPLE_TICKET}.pdf`);
    ok("A signed ticket file can be removed again");
  } catch (error) {
    fail("Filing in the scratch storage folder", error);
  } finally {
    if (before === undefined) {
      delete process.env.PRECASTAPP_STORAGE_DIR;
    } else {
      process.env.PRECASTAPP_STORAGE_DIR = before;
    }
    await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

async function readRealScan(filePath: string): Promise<void> {
  console.log("");
  console.log(`Reading ${filePath}`);
  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch (error) {
    fail("The scan file can be opened", error);
    return;
  }
  const pageCount = await countPdfPages(bytes);
  const started = Date.now();
  const reads = await readScanPages(
    bytes,
    Array.from({ length: pageCount }, (_, index) => index + 1),
  );
  const seconds = (Date.now() - started) / 1000;
  let found = 0;
  for (let page = 1; page <= pageCount; page += 1) {
    const read = reads.get(page);
    if (read?.code) {
      found += 1;
      console.log(
        `       page ${page}: ${read.code.ticketNumber}, copy ${read.code.copyNumber}, sheet ${read.code.pageNumber} of ${read.code.pageCount}${read.rotation ? `, turned ${read.rotation}` : ""}`,
      );
    } else if (read?.blank) {
      console.log(`       page ${page}: blank`);
    } else {
      console.log(`       page ${page}: ${read?.readNote ?? "not read"}`);
    }
  }
  expectThat(
    found > 0,
    `A ticket code was read on ${found} of ${pageCount} page(s), ${(seconds / Math.max(1, pageCount)).toFixed(2)} s a page`,
  );
}

async function main(): Promise<void> {
  console.log("Scan In self-check");
  console.log(`  Node.js ${process.version} on ${process.platform} ${process.arch}`);
  console.log(`  Folder  ${process.cwd()}`);
  console.log("");
  if (nodeMajorVersion() >= SCAN_READER_NODE_MAJOR) {
    ok(`Node.js is ${SCAN_READER_NODE_MAJOR} or newer`);
  } else {
    console.log(
      `[WARN] The reader's PDF library asks for Node.js ${SCAN_READER_NODE_MAJOR} or newer. This is ${process.version}. If a check below fails, update Node.js first.`,
    );
  }

  try {
    await checkReader();
  } catch (error) {
    fail("Reading the sample scan", error);
  }
  await checkStorage();

  const realScan = process.argv[2];
  if (realScan) {
    try {
      await readRealScan(realScan);
    } catch (error) {
      fail("Reading the scan file", error);
    }
  }

  console.log("");
  if (failed === 0) {
    console.log(`All ${passed} checks passed. The scan reader works on this machine.`);
  } else {
    console.log(`${failed} check(s) FAILED, ${passed} passed. Scan In will not read scans on this machine until that is fixed.`);
  }
  process.exitCode = failed === 0 ? 0 : 1;
}

void main();
