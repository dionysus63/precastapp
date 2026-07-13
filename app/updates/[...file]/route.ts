import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";

/**
 * Serves desktop auto-update files (latest.yml + installers) from
 * public/updates at REQUEST time. Next only serves public/ paths that
 * existed at build time, so without this route every desktop publish would
 * require a server rebuild before workstations could download it. Files
 * already known to the build are served by the static layer and never
 * reach this route; new ones land here.
 *
 * No auth (matching the middleware bypass): the updater runs before login.
 */

const UPDATES_DIR = path.join(process.cwd(), "public", "updates");

const CONTENT_TYPES: Record<string, string> = {
  ".yml": "text/yaml; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".exe": "application/octet-stream",
  ".blockmap": "application/octet-stream",
};

type RouteContext = {
  params: Promise<{ file: string[] }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { file } = await context.params;
  const requested = file.map((segment) => decodeURIComponent(segment)).join("/");

  // Containment: resolve inside public/updates only, no traversal.
  const resolved = path.resolve(UPDATES_DIR, requested);
  if (
    resolved !== UPDATES_DIR &&
    !resolved.startsWith(UPDATES_DIR + path.sep)
  ) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const extension = path.extname(resolved).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    return new NextResponse("Not found.", { status: 404 });
  }

  let fileStat;
  try {
    fileStat = await stat(resolved);
  } catch {
    return new NextResponse("Not found.", { status: 404 });
  }
  if (!fileStat.isFile()) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const stream = Readable.toWeb(
    createReadStream(resolved),
  ) as ReadableStream<Uint8Array>;

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileStat.size),
      "Cache-Control": "no-cache",
    },
  });
}
