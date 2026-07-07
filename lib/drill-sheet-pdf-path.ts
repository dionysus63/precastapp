import path from "path";
import {
  resolveQuotePdfOutputPath,
  sanitizeFilenamePart,
} from "@/lib/quote-pdf-path";

export const DRILL_SHEET_PDF_FALLBACK_DIR =
  "C:\\PrecastGeneratedPDFs\\DrillSheets";
// Must be one of JOB_SUBFOLDERS (lib/job-folder-constants.ts) or
// registerJobFile rejects the generated PDF after writing it.
export const DRILL_SHEET_PDF_JOB_SUBFOLDER = "09 Cut Sheets";

export function buildDrillSheetPdfBaseName(
  manholeNumber: string,
  projectName: string,
) {
  const parts = [
    sanitizeFilenamePart(manholeNumber),
    sanitizeFilenamePart(projectName),
  ].filter(Boolean);

  if (parts.length === 0) {
    return "Drill Sheet";
  }

  return parts.join(" - ");
}

export function resolveDrillSheetPdfDirectory(
  jobFolderPath: string | null | undefined,
) {
  const trimmed = jobFolderPath?.trim();
  if (trimmed) {
    return path.join(trimmed, DRILL_SHEET_PDF_JOB_SUBFOLDER);
  }

  return DRILL_SHEET_PDF_FALLBACK_DIR;
}

export { resolveQuotePdfOutputPath as resolveDrillSheetPdfOutputPath };
