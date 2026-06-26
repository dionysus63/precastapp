import { access } from "fs/promises";
import path from "path";
import puppeteer, { type Browser, type Page } from "puppeteer";

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

// Reuse a single Chromium instance across requests instead of launching and
// closing a full browser for every PDF/raster operation. Each operation gets
// its own page (closed afterwards); the browser stays warm.
const globalForBrowser = globalThis as unknown as {
  __pdfBrowser?: Browser | null;
  __pdfBrowserPromise?: Promise<Browser> | null;
};

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    executablePath: await resolveBrowserExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

async function getSharedBrowser(): Promise<Browser> {
  const existing = globalForBrowser.__pdfBrowser;
  if (existing && existing.connected) {
    return existing;
  }

  // Coalesce concurrent launches so we never open two browsers at once.
  if (!globalForBrowser.__pdfBrowserPromise) {
    globalForBrowser.__pdfBrowserPromise = launchBrowser()
      .then((browser) => {
        globalForBrowser.__pdfBrowser = browser;
        browser.on("disconnected", () => {
          if (globalForBrowser.__pdfBrowser === browser) {
            globalForBrowser.__pdfBrowser = null;
          }
        });
        return browser;
      })
      .finally(() => {
        globalForBrowser.__pdfBrowserPromise = null;
      });
  }

  return globalForBrowser.__pdfBrowserPromise;
}

/**
 * Runs `fn` with a fresh page on the shared browser. The page is always closed;
 * the browser is left running for reuse by the next call.
 */
export async function withBrowserPage<T>(
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function closeSharedBrowser() {
  const browser = globalForBrowser.__pdfBrowser;
  globalForBrowser.__pdfBrowser = null;
  if (browser && browser.connected) {
    await browser.close().catch(() => undefined);
  }
}
