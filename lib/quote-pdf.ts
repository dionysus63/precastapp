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
