import { access, mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import puppeteer from "puppeteer";
import sharp from "sharp";
import { getJobsRoot } from "@/lib/app-settings";
import { resolveBrowserExecutablePath } from "@/lib/quote-pdf";
import { withDatabaseRetry } from "@/lib/prisma";

export const COMPANY_LOGO_FILENAME = "company-logo.png";
export const DEFAULT_SEED_LOGO_PDF_PATH =
  "C:\\Users\\Nick\\OneDrive - Long Island Precast\\Desktop\\PDFs\\LIP Vector Logo.pdf";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
]);

function pathToLocalFileUrl(filePath: string) {
  return pathToFileURL(path.resolve(filePath)).href;
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveBrandAssetsDir() {
  const jobsRoot = await getJobsRoot();
  return path.join(jobsRoot, "Brand");
}

export async function resolveCompanyLogoPath() {
  const brandDir = await resolveBrandAssetsDir();
  return path.join(brandDir, COMPANY_LOGO_FILENAME);
}

export async function getCompanyLogoPath(): Promise<string | null> {
  const settings = await withDatabaseRetry((client) =>
    client.appSettings.findUnique({
      where: { id: "default" },
      select: { companyLogoPath: true },
    }),
  );

  const logoPath = settings?.companyLogoPath?.trim();
  if (!logoPath) {
    return null;
  }

  if (!(await pathExists(logoPath))) {
    return null;
  }

  return logoPath;
}

export async function hasCompanyLogo() {
  return (await getCompanyLogoPath()) !== null;
}

export async function getCompanyLogoDataUri(): Promise<string | null> {
  const logoPath = await getCompanyLogoPath();
  if (!logoPath) {
    return null;
  }

  const bytes = await readFile(logoPath);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

async function setCompanyLogoPath(logoPath: string | null) {
  await withDatabaseRetry((client) =>
    client.appSettings.update({
      where: { id: "default" },
      data: { companyLogoPath: logoPath },
    }),
  );
}

/**
 * Finds the bounding box of the PDF page itself within a screenshot of
 * Chromium's built-in PDF viewer, by locating the widest contiguous
 * near-white run on each row. The viewer's dark chrome also contains small
 * bright UI elements (e.g. the page thumbnail panel), so a naive bbox over
 * every bright pixel gets dragged wide by those; requiring a wide run per
 * row (most of the screenshot's width) isolates the actual rendered page,
 * and avoids hardcoding toolbar height, which varies by Chrome version.
 */
async function findPageBoundsPng(buffer: Buffer) {
  const { data, info } = await sharp(buffer)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const threshold = 235;
  const minRunFraction = 0.3;

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    let runStart = -1;
    let bestStart = -1;
    let bestLen = 0;
    for (let x = 0; x <= width; x += 1) {
      const bright = x < width && data[y * width + x] >= threshold;
      if (bright) {
        if (runStart === -1) runStart = x;
      } else if (runStart !== -1) {
        const len = x - runStart;
        if (len > bestLen) {
          bestLen = len;
          bestStart = runStart;
        }
        runStart = -1;
      }
    }
    if (bestLen >= width * minRunFraction) {
      if (bestStart < minX) minX = bestStart;
      if (bestStart + bestLen - 1 > maxX) maxX = bestStart + bestLen - 1;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return null;
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export async function convertPdfToPng(sourcePath: string, destPath: string) {
  const fileUrl = pathToLocalFileUrl(sourcePath);
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: await resolveBrowserExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    // Chromium's built-in PDF viewer does not render inside an <embed> in
    // headless mode (it silently produces a blank page), but it does render
    // correctly when the page navigates directly to a PDF URL. Navigate
    // there, screenshot the whole viewer, then crop out its dark toolbar/
    // background chrome to leave just the rendered page.
    await page.setViewport({ width: 900, height: 700, deviceScaleFactor: 2 });
    await page.goto(fileUrl, { waitUntil: "load" });
    // The built-in PDF viewer's title bar renders immediately, but the
    // actual page content (what we want to crop to) renders asynchronously
    // afterward — a short wait can capture only the title bar.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const fullShot = await page.screenshot({ type: "png" });
    const bounds = await findPageBoundsPng(Buffer.from(fullShot));
    if (!bounds) {
      throw new Error("Could not locate the PDF page within the rendered viewer.");
    }
    await sharp(Buffer.from(fullShot)).extract(bounds).toFile(destPath);
  } finally {
    await browser.close();
  }
}

async function rasterizeImageBufferToPng(
  buffer: Buffer,
  mimeType: string,
  destPath: string,
) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: await resolveBrowserExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 400, deviceScaleFactor: 2 });
    const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
    await page.setContent(
      `<!DOCTYPE html><html><head><style>html,body{margin:0;background:transparent}body{display:inline-block}img{display:block;max-width:760px;max-height:360px}</style></head><body><img src="${dataUri}" alt="" /></body></html>`,
      { waitUntil: "load" },
    );
    const image = await page.$("img");
    if (!image) {
      throw new Error("Could not rasterize logo image.");
    }
    await image.screenshot({
      path: destPath as `${string}.png`,
      type: "png",
      omitBackground: true,
    });
  } finally {
    await browser.close();
  }
}

async function writeLogoPngFromFile(file: File, destPath: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("Logo file is empty.");
  }
  if (buffer.length > MAX_LOGO_BYTES) {
    throw new Error("Logo file must be 5 MB or smaller.");
  }

  const mimeType = file.type.toLowerCase();
  const extension = path.extname(file.name).toLowerCase();

  if (mimeType === "application/pdf" || extension === ".pdf") {
    const brandDir = path.dirname(destPath);
    await mkdir(brandDir, { recursive: true });
    const tempPdf = path.join(brandDir, "company-logo-source.pdf");
    await writeFile(tempPdf, buffer);
    await convertPdfToPng(tempPdf, destPath);
    return;
  }

  if (mimeType === "image/png" || extension === ".png") {
    await mkdir(path.dirname(destPath), { recursive: true });
    await writeFile(destPath, buffer);
    return;
  }

  if (
    IMAGE_MIME_TYPES.has(mimeType) ||
    [".jpg", ".jpeg", ".webp", ".svg"].includes(extension)
  ) {
    const resolvedMime =
      mimeType ||
      (extension === ".svg"
        ? "image/svg+xml"
        : extension === ".webp"
          ? "image/webp"
          : "image/jpeg");
    await mkdir(path.dirname(destPath), { recursive: true });
    await rasterizeImageBufferToPng(buffer, resolvedMime, destPath);
    return;
  }

  throw new Error("Logo must be PNG, JPG, WebP, SVG, or PDF.");
}

export async function saveCompanyLogo(file: File) {
  const destPath = await resolveCompanyLogoPath();
  const brandDir = path.dirname(destPath);

  await mkdir(brandDir, { recursive: true });

  const previousPath = await getCompanyLogoPath();
  await writeLogoPngFromFile(file, destPath);
  await setCompanyLogoPath(destPath);

  if (previousPath && previousPath !== destPath && (await pathExists(previousPath))) {
    await unlink(previousPath).catch(() => undefined);
  }

  return destPath;
}

export async function removeCompanyLogo() {
  const logoPath = await getCompanyLogoPath();
  if (logoPath && (await pathExists(logoPath))) {
    await unlink(logoPath).catch(() => undefined);
  }

  await setCompanyLogoPath(null);
}

export async function seedLogoFromPdf(sourcePath: string) {
  const existing = await getCompanyLogoPath();
  if (existing) {
    return existing;
  }

  if (!(await pathExists(sourcePath))) {
    return null;
  }

  const destPath = await resolveCompanyLogoPath();
  await mkdir(path.dirname(destPath), { recursive: true });
  await convertPdfToPng(sourcePath, destPath);
  await setCompanyLogoPath(destPath);
  return destPath;
}

export async function getCompanyLogoUpdatedAt(
  logoPathFromSettings?: string | null,
): Promise<number | null> {
  const logoPath =
    logoPathFromSettings !== undefined
      ? logoPathFromSettings?.trim() || null
      : await getCompanyLogoPath();

  if (!logoPath) {
    return null;
  }

  if (!(await pathExists(logoPath))) {
    return null;
  }

  const fileStat = await stat(logoPath);
  return fileStat.mtimeMs;
}

export function companyLogoApiUrl(updatedAt?: number | null) {
  if (!updatedAt) {
    return "/api/brand/logo";
  }
  return `/api/brand/logo?t=${Math.floor(updatedAt)}`;
}
