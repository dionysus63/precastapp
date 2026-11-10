// Links and file names for a job's combined drill sheet PDF (every sheet,
// or a chosen set, merged into one file by /api/jobs/<id>/drill-sheets).
//
// Safe to import from both server and client modules.

function safeFilePart(value: string, maxLength: number): string {
  return value
    .replace(/[\\/:*?"<>|\r\n]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, maxLength)
    // No stray dash or space where a replaced character ended the name.
    .replace(/^[-\s]+|[-\s]+$/g, "");
}

/**
 * The combined PDF's file name, e.g. "Drill Sheets - 24-105 - Main St
 * Sewer.pdf". The project name is what tells the files apart once they sit
 * in an email or a folder.
 */
export function drillSheetsPacketFileName(
  jobNumber: string,
  projectName?: string | null,
): string {
  const parts = [
    "Drill Sheets",
    safeFilePart(jobNumber ?? "", 40),
    safeFilePart(projectName ?? "", 80),
  ].filter(Boolean);
  return `${parts.join(" - ")}.pdf`;
}

/**
 * Where the combined PDF is served. Without `structureIds` it holds every
 * drill sheet on the job; `download` serves it as a file to save (what a
 * drag-out needs) instead of showing it in the viewer.
 */
export function drillSheetsPacketHref(
  jobId: string,
  options: { structureIds?: string[]; download?: boolean } = {},
): string {
  const params: string[] = [];
  if (options.structureIds?.length) {
    params.push(
      `structureIds=${options.structureIds.map(encodeURIComponent).join(",")}`,
    );
  }
  if (options.download) {
    params.push("download=1");
  }
  const base = `/api/jobs/${encodeURIComponent(jobId)}/drill-sheets`;
  return params.length > 0 ? `${base}?${params.join("&")}` : base;
}
