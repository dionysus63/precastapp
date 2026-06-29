import {
  resolveBrowserExecutablePath,
  withBrowserPage,
} from "@/lib/puppeteer-browser";

// Re-exported for backwards compatibility with existing importers.
export { resolveBrowserExecutablePath };

export async function writeQuotePdfFromHtml(html: string, outputPath: string) {
  await withBrowserPage(async (page) => {
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMediaType("print");
    await page.pdf({
      path: outputPath,
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
      },
    });
  });
}

/**
 * Renders HTML to PDF bytes (no file written) so callers can post-process the
 * document — e.g. append interactive AcroForm pages with pdf-lib.
 */
export async function renderPdfBytesFromHtml(html: string): Promise<Uint8Array> {
  return withBrowserPage(async (page) => {
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMediaType("print");
    const bytes = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in",
      },
    });
    return new Uint8Array(bytes);
  });
}
