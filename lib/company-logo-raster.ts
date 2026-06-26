import { access, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { withBrowserPage } from "@/lib/puppeteer-browser";
import {
  getCompanyLogoPath,
  resolveCompanyLogoPath,
  setCompanyLogoPath,
} from "@/lib/company-logo";

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

export async function convertPdfToPng(sourcePath: string, destPath: string) {
  const fileUrl = pathToLocalFileUrl(sourcePath);
  await withBrowserPage(async (page) => {
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
  });
}

async function rasterizeImageBufferToPng(
  buffer: Buffer,
  mimeType: string,
  destPath: string,
) {
  await withBrowserPage(async (page) => {
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
  });
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

  if (
    previousPath &&
    previousPath !== destPath &&
    (await pathExists(previousPath))
  ) {
    await unlink(previousPath).catch(() => undefined);
  }

  return destPath;
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
