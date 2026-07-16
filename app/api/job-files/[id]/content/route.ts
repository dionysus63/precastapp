import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { getJobFileForOpen } from "@/lib/job-files-service";
import { withDatabaseRetry } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const INLINE_CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/** Streams an indexed job file for in-app preview (e.g. the tax exempt cert). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await requirePermission(AppPermission.FILES_VIEW);
    const { id } = await context.params;
    const file = await withDatabaseRetry((client) =>
      getJobFileForOpen(client, id),
    );

    const extension = path.extname(file.fileName).toLowerCase();
    const contentType = INLINE_CONTENT_TYPES[extension];
    const bytes = await readFile(file.filePath);
    const safeName = file.fileName.replace(/"/g, "");

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType ?? "application/octet-stream",
        "Content-Disposition": `${contentType ? "inline" : "attachment"}; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Unauthorized or file not found.", { status: 403 });
  }
}
