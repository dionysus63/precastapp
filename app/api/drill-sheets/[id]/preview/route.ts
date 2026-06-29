import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  buildDrillSheetDetail,
  drillSheetDetailInclude,
} from "@/lib/drill-sheet-detail";
import { buildDrillSheetPdfBytes } from "@/lib/drill-sheet-pdf-generate";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.STRUCTURES_VIEW);
    const { id } = await context.params;

    const sheet = await withDatabaseRetry((prisma) =>
      prisma.jobStructure.findUnique({
        where: { id },
        include: drillSheetDetailInclude,
      }),
    );

    if (!sheet) {
      return new NextResponse("Drill sheet not found.", { status: 404 });
    }

    const detail = buildDrillSheetDetail(sheet);
    if (!detail) {
      return new NextResponse("This structure is not a circular drill sheet.", {
        status: 404,
      });
    }

    const built = await buildDrillSheetPdfBytes(sheet);
    if (!built) {
      return new NextResponse("Could not build drill sheet PDF.", {
        status: 500,
      });
    }

    const label = detail.meta.manholeNumber || sheet.id;
    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="drill-sheet-${label}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Drill-Sheet-Pdf-Source": built.source,
      "X-Drill-Sheet-Computed-Variant": built.computedVariant.key,
    };

    if (built.templateVariant) {
      headers["X-Drill-Sheet-Template-Variant"] = built.templateVariant.key;
      headers["X-Drill-Sheet-Template-Name"] = built.templateVariant.originalName;
    }

    return new NextResponse(Buffer.from(built.bytes), {
      status: 200,
      headers,
    });
  } catch {
    return new NextResponse("Unauthorized or failed to generate preview.", {
      status: 403,
    });
  }
}
