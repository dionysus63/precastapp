"use client";

import { PdfDragChip } from "@/components/common/pdf-drag-chip";
import {
  drillSheetsPacketFileName,
  drillSheetsPacketHref,
} from "@/lib/drill-sheets-packet";

/**
 * Quick Build's "everything in one file" button: one PDF holding every drill
 * sheet (in structure number order) that drags onto an email, a folder, or
 * the desktop like the per-sheet PDF chips, or downloads on a click.
 *
 * Without `structureIds` the file holds every drill sheet on the job. The
 * file is built from the saved sheets, so `unsavedNote` is for screens where
 * the grid can be ahead of what is saved.
 */
export function OneOffAllSheetsButton({
  jobId,
  jobNumber,
  projectName,
  sheetCount,
  structureIds,
  scope = "all",
  unsavedNote = false,
}: {
  jobId: string;
  jobNumber: string;
  projectName: string;
  /** How many sheets the file holds, for the label. */
  sheetCount: number;
  structureIds?: string[];
  /**
   * "these" words the label for a results list (the sheets just created or
   * changed), so it doesn't read as every sheet on the job.
   */
  scope?: "all" | "these";
  unsavedNote?: boolean;
}) {
  if (sheetCount <= 0) {
    return null;
  }
  const label =
    sheetCount === 1
      ? scope === "these"
        ? "This Drill Sheet (PDF)"
        : "1 Drill Sheet (PDF)"
      : `${scope === "these" ? "These" : "All"} ${sheetCount} Drill Sheets (one PDF)`;
  const title = [
    sheetCount === 1
      ? "Drag onto an email, a folder, or your desktop to copy this drill sheet as a PDF, or click to download it."
      : `Drag onto an email, a folder, or your desktop to copy all ${sheetCount} drill sheets as one PDF, in structure number order. Click to download it instead.`,
    unsavedNote ? "Changes you haven't saved yet are not in the file." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <PdfDragChip
      href={drillSheetsPacketHref(jobId, { structureIds, download: true })}
      fileName={drillSheetsPacketFileName(jobNumber, projectName)}
      title={title}
      label={label}
      preparingLabel="Building the PDF…"
      className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900 shadow-sm hover:border-sky-400 hover:bg-sky-100"
    />
  );
}
