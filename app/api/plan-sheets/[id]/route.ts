import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getPlanSheetForOpen } from "@/app/quotes/plan-sheet-actions";
import {
  contentDisposition,
  fileRouteErrorResponse,
} from "@/lib/http-responses";

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
        "Content-Disposition": contentDisposition("inline", planSheet.originalName),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return fileRouteErrorResponse(error, "Opening the plan sheet");
  }
}
