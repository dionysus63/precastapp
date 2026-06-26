import { access, readFile, stat, unlink } from "fs/promises";
import path from "path";
import { getJobsRoot } from "@/lib/app-settings";
import { assertPathUnderRoot } from "@/lib/job-path-security";
import { withDatabaseRetry } from "@/lib/prisma";

export const COMPANY_LOGO_FILENAME = "company-logo.png";
export const DEFAULT_SEED_LOGO_PDF_PATH =
  "C:\\Users\\Nick\\OneDrive - Long Island Precast\\Desktop\\PDFs\\LIP Vector Logo.pdf";

export async function pathExists(filePath: string) {
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

export async function setCompanyLogoPath(logoPath: string | null) {
  await withDatabaseRetry((client) =>
    client.appSettings.update({
      where: { id: "default" },
      data: { companyLogoPath: logoPath },
    }),
  );
}

export async function removeCompanyLogo() {
  const logoPath = await getCompanyLogoPath();
  if (logoPath && (await pathExists(logoPath))) {
    // logoPath comes from the DB; only delete a file that lives under the brand
    // assets directory so a tampered setting can't unlink an arbitrary file.
    const brandDir = await resolveBrandAssetsDir();
    assertPathUnderRoot(brandDir, logoPath);
    await unlink(logoPath).catch(() => undefined);
  }

  await setCompanyLogoPath(null);
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
