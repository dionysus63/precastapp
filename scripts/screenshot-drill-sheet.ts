// Visual feedback loop for the drill sheet PDF layout: screenshots the exact
// HTML that lib/drill-sheet-pdf-html.ts produces (served by the dev-only
// /api/drill-sheets/[id]/render-html route) so it can be diffed against
// docs/drill-sheet-target.png. Requires `npm run dev` running separately.
//
// Run with: npx tsx scripts/screenshot-drill-sheet.ts [drillSheetId]
// (defaults to looking up the "SMH-3" fixture seeded by
// scripts/seed-drill-sheet-fixture.ts)
import "dotenv/config";
import path from "path";
import puppeteer from "puppeteer";
import { resolveBrowserExecutablePath } from "../lib/quote-pdf";
import { prisma } from "../lib/prisma";

const DEV_SERVER_URL = process.env.DRILL_SHEET_SHOT_BASE_URL ?? "http://localhost:3000";
const OUTPUT_PATH = path.join(__dirname, "..", "docs", "drill-sheet-current.png");

// The target PNG is 1700x2200px (8.5in x 11in @ 200dpi). Match that exactly
// by rendering at 96dpi CSS pixels and scaling the device pixel ratio up.
const CSS_WIDTH_PX = 816; // 8.5in @ 96dpi
const CSS_HEIGHT_PX = 1056; // 11in @ 96dpi
const DEVICE_SCALE_FACTOR = 1700 / CSS_WIDTH_PX; // ~2.0833, lands exactly on 1700px wide

async function resolveDrillSheetId(argId: string | undefined): Promise<string> {
  if (argId) {
    return argId;
  }
  const sheet = await prisma.jobStructure.findFirst({
    where: { structureNumber: "SMH-3", jobId: null },
    select: { id: true },
  });
  if (!sheet) {
    throw new Error(
      'No drill sheet id given and no "SMH-3" fixture found. Run `npx tsx scripts/seed-drill-sheet-fixture.ts` first, or pass an id explicitly.',
    );
  }
  return sheet.id;
}

async function main() {
  const drillSheetId = await resolveDrillSheetId(process.argv[2]);
  const url = `${DEV_SERVER_URL}/api/drill-sheets/${drillSheetId}/render-html`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetching ${url} failed: ${response.status} ${await response.text()}`);
  }
  const html = await response.text();

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: await resolveBrowserExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: CSS_WIDTH_PX,
      height: CSS_HEIGHT_PX,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
    // setContent (not page.goto) mirrors lib/quote-pdf.ts's writeQuotePdfFromHtml,
    // which also loads HTML directly rather than navigating — and sidesteps a
    // corporate web filter that intercepts http://localhost navigations made by
    // the real installed browser (curl/fetch are unaffected).
    await page.setContent(html, { waitUntil: "load" });

    // The page's own CSS only declares @page margins, which print engines
    // honor but on-screen rendering does not. Re-create that 0.5in margin as
    // real padding here so the screenshot matches what page.pdf() produces.
    await page.addStyleTag({
      content: `
        html, body {
          width: 8.5in !important;
          min-height: 11in;
          padding: 0.5in !important;
          background: #ffffff !important;
        }
      `,
    });

    await page.screenshot({ path: OUTPUT_PATH, type: "png", fullPage: true });
    console.log(`Saved screenshot: ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
