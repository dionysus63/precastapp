import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { listTemplatePdfFields } from "@/lib/drill-sheet-template-pdf";
import { readRectPdfSetFileBytes } from "@/lib/rect-pdf-set-service";
import { rectVariantExpectedFieldNames } from "@/lib/rect-template-pdf-fields";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Field coverage for one uploaded rect PDF-set file. Lives in a route
 * handler because parsing the PDF inside the page's server-component render
 * is ~70x slower in dev; the Sheet PDF Sets page fetches this per slot.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.STRUCTURES_VIEW);
    const { id } = await context.params;

    const file = await withDatabaseRetry((prisma) =>
      prisma.rectSheetPdfSetFile.findUnique({
        where: { id },
        include: { set: { select: { shape: true } } },
      }),
    );
    if (!file) {
      return new NextResponse("PDF not found.", { status: 404 });
    }

    const bytes = await readRectPdfSetFileBytes(file);
    const coverage = await listTemplatePdfFields(
      bytes,
      file.set.shape === "CIRCULAR"
        ? undefined // defaults to the circular sheet convention
        : rectVariantExpectedFieldNames(file.hasTopSlab, file.hasBaseSlab),
    );

    return NextResponse.json({
      matched: coverage.matched.length,
      unmatched: coverage.unmatched,
      missing: coverage.missingFromPdf,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read the PDF.";
    return new NextResponse(message, { status: 500 });
  }
}
