import { NextResponse } from "next/server";
import {
  buildDrillSheetDetail,
  drillSheetDetailInclude,
} from "@/lib/drill-sheet-detail";
import { buildDrillSheetPdfHtml } from "@/lib/drill-sheet-pdf-html";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Dev-only debugging endpoint: returns the exact HTML that becomes the drill
 * sheet PDF (lib/drill-sheet-pdf-html.ts), so scripts/screenshot-drill-sheet.ts
 * can screenshot the *real* layout code instead of the unrelated on-screen
 * preview UI. Lives under /api/ so it is not gated by the session-login
 * middleware (see middleware.ts), matching this app's other unauthenticated
 * /api/ routes.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 404 });
  }

  const { id } = await params;
  const sheet = await prisma.jobStructure.findUnique({
    where: { id },
    include: drillSheetDetailInclude,
  });
  if (!sheet) {
    return NextResponse.json({ error: "Drill sheet not found." }, { status: 404 });
  }

  const detail = buildDrillSheetDetail(sheet);
  if (!detail) {
    return NextResponse.json(
      { error: "This structure is not a circular drill sheet." },
      { status: 400 },
    );
  }

  const html = await buildDrillSheetPdfHtml(detail.meta, detail.result);
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
