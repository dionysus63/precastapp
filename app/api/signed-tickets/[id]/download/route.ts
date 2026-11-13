import { NextResponse } from "next/server";
import { contentDisposition, fileRouteErrorResponse } from "@/lib/http-responses";
import {
  loadSignedTicketFile,
  requireSignedTicketViewer,
} from "@/lib/ticket-scan/signed-file-access";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * A ticket's signed copy as filed by Scan In: a file to save (the Signed
 * Ticket chip drags it out), or shown in the browser with `?view=1`.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    await requireSignedTicketViewer();
    const { id } = await context.params;
    const file = await loadSignedTicketFile(id);
    if (!file) {
      return new NextResponse("Signed ticket not found.", { status: 404 });
    }
    const inline = new URL(request.url).searchParams.get("view") === "1";
    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(
          inline ? "inline" : "attachment",
          file.fileName,
        ),
        "Content-Length": String(file.bytes.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return fileRouteErrorResponse(error, "Signed ticket");
  }
}
