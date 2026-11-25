import { NextResponse } from "next/server";
import { fileRouteErrorResponse } from "@/lib/http-responses";
import { parsePdfZoomParam } from "@/lib/preview-zoom";
import { renderPdfPageImage } from "@/lib/ticket-scan/reader";
import {
  loadSignedTicketFile,
  requireSignedTicketViewer,
} from "@/lib/ticket-scan/signed-file-access";

type RouteContext = {
  params: Promise<{ id: string; page: string }>;
};

/**
 * One page of a filed signed ticket as a picture, for the Scan In preview
 * and beside the Invoices list. `?zoom=` (a preview zoom step) asks for a
 * picture sharp enough to be shown that much larger.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    await requireSignedTicketViewer();
    const { id, page: pageRaw } = await context.params;
    const pageNumber = Number(pageRaw);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return new NextResponse("Page not found.", { status: 404 });
    }
    const file = await loadSignedTicketFile(id);
    if (!file) {
      return new NextResponse("Signed ticket not found.", { status: 404 });
    }
    if (pageNumber > file.pageCount) {
      return new NextResponse("Page not found.", { status: 404 });
    }
    const image = await renderPdfPageImage(file.bytes, pageNumber, {
      zoom: parsePdfZoomParam(new URL(request.url).searchParams.get("zoom")),
    });
    return new NextResponse(new Uint8Array(image.bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(image.bytes.length),
        "X-Page-Count": String(image.pageCount),
        // A signed file never changes once written (a replacement is a new file).
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return fileRouteErrorResponse(error, "Signed ticket picture");
  }
}
