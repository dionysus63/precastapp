import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { contentDisposition, fileRouteErrorResponse } from "@/lib/http-responses";
import { withDatabaseRetry } from "@/lib/prisma";
import { sheetPdfDownloadName } from "@/lib/sheet-pdf";
import { readSheetPdfBytes } from "@/lib/sheet-pdf-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * One Sheet PDF, exactly as it was uploaded (blank, fillable fields intact),
 * served as a file to save. The Sheet PDFs page offers it on each row so a
 * sheet can be edited and uploaded again with Replace.
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

    let bytes: Uint8Array;
    try {
      bytes = await readSheetPdfBytes(sheetPdf);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        return new NextResponse(
          "This PDF is missing from the server's storage folder. Upload it again.",
          { status: 404 },
        );
      }
      throw error;
    }

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(
          "attachment",
          sheetPdfDownloadName(sheetPdf.name),
        ),
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return fileRouteErrorResponse(error, "Sheet PDF file");
  }
}
