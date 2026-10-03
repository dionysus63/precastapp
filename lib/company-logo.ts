import { access, mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import puppeteer from "puppeteer";
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

export async function convertPdfToPng(sourcePath: string, destPath: string) {
  const fileUrl = pathToLocalFileUrl(sourcePath);
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: await resolveBrowserExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 700, deviceScaleFactor: 2 });
    await page.setContent(
      `<!DOCTYPE html>
      <html>
        <head>
          <style>
            html, body { margin: 0; background: transparent; }
            body { padding: 16px; display: inline-block; }
            embed { display: block; width: 760px; height: 520px; }
          </style>
        </head>
        <body>
          <embed src="${fileUrl}" type="application/pdf" />
        </body>
      </html>`,
      { waitUntil: "load" },
    );
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const embed = await page.$("embed");
    if (embed) {
      await embed.screenshot({
        path: destPath as `${string}.png`,
        type: "png",
        omitBackground: true,
      });
      return;
    }

    await page.screenshot({
      path: destPath as `${string}.png`,
      type: "png",
      omitBackground: true,
      clip: { x: 0, y: 0, width: 760, height: 520 },
    });
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
