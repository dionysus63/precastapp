import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  buildDrillSheetDetail,
  drillSheetDetailInclude,
} from "@/lib/drill-sheet-detail";
import { buildDrillSheetPdfBytes } from "@/lib/drill-sheet-pdf-generate";
import { rectSheetDetailInclude } from "@/lib/rect-sheet-detail";
import { buildRectSheetPdfBytes } from "@/lib/rect-sheet-pdf-generate";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function rectPreviewResponse(id: string): Promise<NextResponse> {
  const sheet = await withDatabaseRetry((prisma) =>
    prisma.jobStructure.findUnique({
      where: { id },
      include: rectSheetDetailInclude,
    }),
  );
  if (!sheet) {
    return new NextResponse("Drill sheet not found.", { status: 404 });
  }

  const built = await buildRectSheetPdfBytes(sheet);
  if (!built.ok) {
    return new NextResponse(built.error, { status: 500 });
  }

  const label = built.meta.structureNumber || sheet.id;
  return new NextResponse(Buffer.from(built.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="drill-sheet-${label}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Drill-Sheet-Pdf-Source": "rect-template",
      "X-Drill-Sheet-Template-Variant": built.variantKey,
      "X-Drill-Sheet-Template-Name": built.originalName,
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.STRUCTURES_VIEW);
    const { id } = await context.params;

    // Rectangular sheets fill their own PDF-set variants; everything below
    // is the circular flow.
    const shapeRow = await withDatabaseRetry((prisma) =>
      prisma.jobStructure.findUnique({
        where: { id },
        select: { structureTemplate: { select: { shape: true } } },
      }),
    );
    if (!shapeRow) {
      return new NextResponse("Drill sheet not found.", { status: 404 });
    }
    if (shapeRow.structureTemplate?.shape === "RECTANGULAR") {
      return await rectPreviewResponse(id);
    }

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
