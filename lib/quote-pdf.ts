import { access } from "fs/promises";
import path from "path";
import puppeteer from "puppeteer";

const BROWSER_INSTALL_HINT =
  "Install Brave, or run `npm run puppeteer:install`, then restart the dev server.";

function getWindowsBrowserPaths() {
  const localAppData = process.env.LOCALAPPDATA ?? "";
  return [
    path.join(
      localAppData,
      "BraveSoftware",
      "Brave-Browser",
      "Application",
      "brave.exe",
    ),
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveBrowserExecutablePath() {
  for (const candidate of getWindowsBrowserPaths()) {
    if (candidate && (await pathExists(candidate))) {
      return candidate;
    }
  }

  try {
    const bundledPath = await puppeteer.executablePath();
    if (await pathExists(bundledPath)) {
      return bundledPath;
    }
  } catch {
    // Fall through to install hint.
  }

  throw new Error(
    `No Chromium browser found for PDF generation. ${BROWSER_INSTALL_HINT}`,
  );
}

export async function writeQuotePdfFromHtml(html: string, outputPath: string) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: await resolveBrowserExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
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
  } finally {
    await browser.close();
  }
}
