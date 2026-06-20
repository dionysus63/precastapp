import { access, mkdir } from "fs/promises";
import path from "path";
import { getQuotePdfFallbackDir, getQuotePdfJobSubfolder } from "@/lib/app-settings";

export const QUOTE_PDF_FALLBACK_DIR = "C:\\PrecastGeneratedPDFs\\Quotes";
export const QUOTE_PDF_JOB_SUBFOLDER = "02 Quotes";

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;

export function sanitizeFilenamePart(value: string) {
  return value
    .replace(INVALID_FILENAME_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
}

export function buildQuotePdfBaseName(
  quoteNumber: string,
  customerName: string,
  projectName: string,
) {
  const parts = [
    sanitizeFilenamePart(quoteNumber),
    sanitizeFilenamePart(customerName),
    sanitizeFilenamePart(projectName),
  ].filter(Boolean);

  if (parts.length === 0) {
    throw new Error("Quote PDF filename is empty after sanitization.");
  }

  return parts.join(" - ");
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveQuotePdfOutputPath(
  outputDirectory: string,
  baseName: string,
) {
  await mkdir(outputDirectory, { recursive: true });

  const exactPath = path.join(outputDirectory, `${baseName}.pdf`);
  if (!(await fileExists(exactPath))) {
    return exactPath;
  }

  for (let suffix = 1; suffix <= 999; suffix += 1) {
    const candidatePath = path.join(outputDirectory, `${baseName}-${suffix}.pdf`);
    if (!(await fileExists(candidatePath))) {
      return candidatePath;
    }
  }

  throw new Error(
    `Could not find an available PDF filename for "${baseName}" in ${outputDirectory}.`,
  );
}

export async function resolveQuotePdfDirectory(
  jobFolderPath: string | null | undefined,
) {
  const trimmed = jobFolderPath?.trim();
  const quoteSubfolder = await getQuotePdfJobSubfolder();
  if (trimmed) {
    return path.join(trimmed, quoteSubfolder);
  }

  return getQuotePdfFallbackDir();
}
