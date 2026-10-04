import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

// The desktop shell polls this to detect a server redeploy (new `next build`)
// so it can drop its HTTP cache — stale cached chunks otherwise break
// navigation until the cache is hand-deleted. Deliberately unauthenticated:
// the build id is the only thing a caller learns, and the login page already
// exposes the build's asset hashes.

// `.next/BUILD_ID` can never change while this server process is running, so
// read it once. The dev server has no build id; report "development".
let cachedBuildId: string | null = null;

async function readBuildId(): Promise<string> {
  if (cachedBuildId) {
    return cachedBuildId;
  }
  try {
    const raw = await readFile(
      path.join(process.cwd(), ".next", "BUILD_ID"),
      "utf8",
    );
    const id = raw.trim();
    if (id) {
      cachedBuildId = id;
      return id;
    }
  } catch {
    // fall through to the dev fallback
  }
  return "development";
}

// Must run at request time: during `next build` the BUILD_ID file does not
// exist yet, so a prerendered response would bake in the wrong value.
export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse(await readBuildId(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
