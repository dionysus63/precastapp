import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { buildJobDrillSheetsPdfBytes } from "@/lib/job-drill-sheets-pdf";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.STRUCTURES_VIEW);
    const { jobId } = await context.params;
    const structureIds = (new URL(request.url).searchParams.get("structureIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 500);

    const built = await buildJobDrillSheetsPdfBytes(jobId, { structureIds });
    if (!built.ok) {
      return new NextResponse(built.error, { status: 404 });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="drill-sheets-${built.jobNumber}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Drill-Sheets-Included": String(built.included.length),
    };
    if (built.skipped.length > 0) {
      headers["X-Drill-Sheets-Skipped"] = built.skipped
        .map((entry) => entry.structureNumber)
        .join(",");
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
