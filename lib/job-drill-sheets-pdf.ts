// Builds one combined PDF containing every drill sheet on a job (circular
// and rectangular), ordered by structure number. Sheets that cannot render
// (e.g. a template missing its PDF-set variant) are skipped and reported so
// one bad structure never blocks the rest of the packet.

import { PDFDocument } from "pdf-lib";
import {
  buildDrillSheetDetail,
  drillSheetDetailInclude,
} from "@/lib/drill-sheet-detail";
import { dedupeSharedPdfObjects } from "@/lib/pdf-dedupe";
import { buildDrillSheetPdfBytes } from "@/lib/drill-sheet-pdf-generate";
import { rectSheetDetailInclude } from "@/lib/rect-sheet-detail";
import { buildRectSheetPdfBytes } from "@/lib/rect-sheet-pdf-generate";
import { withDatabaseRetry } from "@/lib/prisma";

export type JobDrillSheetsPdfResult =
  | {
      ok: true;
      bytes: Uint8Array;
      jobNumber: string;
      jobFolderPath: string | null;
      included: string[];
      skipped: { structureNumber: string; reason: string }[];
    }
  | { ok: false; error: string };

export async function buildJobDrillSheetsPdfBytes(
  jobId: string,
  options: {
    /** Limit the packet to these structures (e.g. a table selection). */
    structureIds?: string[];
  } = {},
): Promise<JobDrillSheetsPdfResult> {
  const job = await withDatabaseRetry((prisma) =>
    prisma.job.findUnique({
      where: { id: jobId },
      select: { jobNumber: true, folderPath: true },
    }),
  );
  if (!job) {
    return { ok: false, error: "Job not found." };
  }

  const rows = await withDatabaseRetry((prisma) =>
    prisma.jobStructure.findMany({
      // Placeholder structures without a calc row have no sheet yet.
      where: {
        jobId,
        calc: { isNot: null },
        ...(options.structureIds?.length
          ? { id: { in: options.structureIds } }
          : {}),
      },
      select: {
        id: true,
        structureNumber: true,
        structureTemplate: { select: { shape: true } },
      },
    }),
  );
  rows.sort((a, b) =>
    (a.structureNumber ?? "").localeCompare(b.structureNumber ?? "", undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
  if (rows.length === 0) {
    return {
      ok: false,
      error: options.structureIds?.length
        ? "None of the selected structures have drill sheets."
        : "This job has no drill sheets yet.",
    };
  }

  const merged = await PDFDocument.create();
  const included: string[] = [];
  const skipped: { structureNumber: string; reason: string }[] = [];

  for (const row of rows) {
    const structureNumber = row.structureNumber ?? row.id;
    try {
      let bytes: Uint8Array | null = null;
      if (row.structureTemplate?.shape === "RECTANGULAR") {
        const sheet = await withDatabaseRetry((prisma) =>
          prisma.jobStructure.findUnique({
            where: { id: row.id },
            include: rectSheetDetailInclude,
          }),
        );
        if (sheet) {
          const built = await buildRectSheetPdfBytes(sheet);
          if (built.ok) {
            bytes = built.bytes;
          } else {
            skipped.push({ structureNumber, reason: built.error });
            continue;
          }
        }
      } else {
        const sheet = await withDatabaseRetry((prisma) =>
          prisma.jobStructure.findUnique({
            where: { id: row.id },
            include: drillSheetDetailInclude,
          }),
        );
        if (sheet && buildDrillSheetDetail(sheet)) {
          const built = await buildDrillSheetPdfBytes(sheet);
          if (built) {
            bytes = built.bytes;
          }
        }
      }
      if (!bytes) {
        skipped.push({
          structureNumber,
          reason: "Could not build this structure's sheet.",
        });
        continue;
      }
      const source = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(source, source.getPageIndices());
      for (const page of pages) {
        merged.addPage(page);
      }
      included.push(structureNumber);
    } catch (error) {
      skipped.push({
        structureNumber,
        reason:
          error instanceof Error ? error.message : "Failed to render sheet.",
      });
    }
  }

  if (merged.getPageCount() === 0) {
    return {
      ok: false,
      error:
        skipped[0]?.reason ?? "None of this job's drill sheets could render.",
    };
  }

  merged.setTitle(`Drill Sheets — ${job.jobNumber}`);
  // Every sheet carries a full copy of its template's fonts/logo; collapse
  // the identical resources so the packet stays a few MB instead of tens.
  dedupeSharedPdfObjects(merged);
  return {
    ok: true,
    bytes: await merged.save(),
    jobNumber: job.jobNumber,
    jobFolderPath: job.folderPath ?? null,
    included,
    skipped,
  };
}
