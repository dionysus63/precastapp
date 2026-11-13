import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { fileRouteErrorResponse } from "@/lib/http-responses";
import { withDatabaseRetry } from "@/lib/prisma";
import { parseScanPages } from "@/lib/ticket-scan/batch-state";
import { renderPdfPageImage } from "@/lib/ticket-scan/reader";
import { readScanSource } from "@/lib/ticket-scan/storage";

type RouteContext = {
  params: Promise<{ batchId: string; seq: string }>;
};

/**
 * One page of the scan being worked on, as a picture for the Scan In
 * preview, turned upright the way the page's row says.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.INVOICES_VIEW);
    const { batchId, seq: seqRaw } = await context.params;
    const seq = Number(seqRaw);
    if (!Number.isInteger(seq) || seq < 1) {
      return new NextResponse("Page not found.", { status: 404 });
    }

    const batch = await withDatabaseRetry((prisma) =>
      prisma.ticketScanBatch.findUnique({
        where: { id: batchId },
        select: { status: true, pagesJson: true },
      }),
    );
    const page =
      batch?.status === "OPEN"
        ? parseScanPages(batch.pagesJson).find((entry) => entry.seq === seq)
        : undefined;
    if (!page) {
      return new NextResponse(
        "This page is no longer in the scan. It was filed or removed.",
        { status: 404 },
      );
    }

    const bytes = await readScanSource(batchId, page.sourceId);
    const image = await renderPdfPageImage(bytes, page.sourcePage, {
      rotation: page.rotation,
    });
    return new NextResponse(new Uint8Array(image.bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(image.bytes.length),
        // The address carries the page's turn, so a turned page is a new address.
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (error) {
    return fileRouteErrorResponse(error, "Scan page picture");
  }
}
