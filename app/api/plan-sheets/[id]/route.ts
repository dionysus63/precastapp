import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getPlanSheetForOpen } from "@/app/quotes/plan-sheet-actions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const planSheet = await getPlanSheetForOpen(id);
    const bytes = await readFile(planSheet.filePath);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${planSheet.originalName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Unauthorized or plan sheet not found.", {
      status: 403,
    });
  }
}
