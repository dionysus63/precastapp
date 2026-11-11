import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { contentDisposition, fileRouteErrorResponse } from "@/lib/http-responses";
import { readRectPdfSetFileBytes } from "@/lib/rect-pdf-set-service";
import { sheetPdfSetFileDownloadName } from "@/lib/sheet-pdf-set-download";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * One Sheet PDF Set slot's PDF, exactly as it was uploaded (blank, fillable
 * fields intact), served as a file to save. The Sheet PDF Sets page offers it
 * on each slot so a sheet can be edited and uploaded again with Replace.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.STRUCTURES_VIEW);
    const { id } = await context.params;

    const file = await withDatabaseRetry((prisma) =>
      prisma.rectSheetPdfSetFile.findUnique({
        where: { id },
        include: { set: { select: { name: true, shape: true } } },
      }),
    );
    if (!file) {
      return new NextResponse("PDF not found.", { status: 404 });
    }

    let bytes: Uint8Array;
    try {
      bytes = await readRectPdfSetFileBytes(file);
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
          sheetPdfSetFileDownloadName(
            file.set.name,
            file.set.shape === "CIRCULAR" ? "CIRCULAR" : "RECTANGULAR",
            file,
          ),
        ),
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return fileRouteErrorResponse(error, "Sheet PDF set file");
  }
}
