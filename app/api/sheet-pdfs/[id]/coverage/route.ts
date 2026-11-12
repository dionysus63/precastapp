import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import { sheetPdfFieldCoverage } from "@/lib/sheet-pdf-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Field check for one Sheet PDF. Lives in a route handler because parsing
 * the PDF inside a page's server-component render is ~70x slower in dev; the
 * Sheet PDFs page and the template editor fetch it after they paint.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.STRUCTURES_VIEW);
    const { id } = await context.params;

    const sheetPdf = await withDatabaseRetry((prisma) =>
      prisma.sheetPdf.findUnique({ where: { id } }),
    );
    if (!sheetPdf) {
      return new NextResponse("Sheet PDF not found.", { status: 404 });
    }

    let coverage;
    try {
      coverage = await sheetPdfFieldCoverage(sheetPdf);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        return new NextResponse(
          "The PDF file is missing from the server. Use Replace to upload it again.",
          { status: 404 },
        );
      }
      throw error;
    }

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
