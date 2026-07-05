import path from "path";
import {
  resolveQuotePdfOutputPath,
  sanitizeFilenamePart,
} from "@/lib/quote-pdf-path";

export const PLAN_SHEET_FALLBACK_DIR =
  "C:\\PrecastGeneratedPDFs\\PlanSheets";
export const PLAN_SHEET_JOB_SUBFOLDER = "01 Construction Plans";

export function resolvePlanSheetDirectory(
  jobFolderPath: string | null | undefined,
) {
  const trimmed = jobFolderPath?.trim();
  if (trimmed) {
    return path.join(trimmed, PLAN_SHEET_JOB_SUBFOLDER);
  }

  return PLAN_SHEET_FALLBACK_DIR;
}

export function buildPlanSheetBaseName(originalName: string) {
  const stem = sanitizeFilenamePart(
    path.basename(originalName, path.extname(originalName)),
  );
  return stem || "Plan Sheet";
}

export { resolveQuotePdfOutputPath as resolvePlanSheetOutputPath };
