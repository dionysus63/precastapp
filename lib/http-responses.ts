import { NextResponse } from "next/server";
import { isNextRedirectError } from "@/lib/server/action-errors";

/**
 * Typographic characters Office and Outlook produce constantly, mapped to
 * plain ASCII. Used for the ASCII fallback in file names.
 */
const ASCII_REPLACEMENTS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "–": "-",
  "—": "-",
  "−": "-",
  "…": "...",
  " ": " ",
  "′": "'",
  "″": '"',
};

function toAsciiFileName(value: string): string {
  return value
    .replace(/[‘’‚“”„–—−… ′″]/g, (char) =>
      ASCII_REPLACEMENTS[char] ?? "_",
    )
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "_");
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * A Content-Disposition value that is safe for any file name. HTTP header
 * values must be Latin-1 — Node throws on anything else ("Cannot convert
 * argument to a ByteString"), which turned every file named with an en dash
 * or curly quote into a failed download. `filename` carries an ASCII
 * fallback; `filename*` (RFC 6266/5987) carries the exact UTF-8 name, which
 * browsers prefer.
 */
export function contentDisposition(
  type: "inline" | "attachment",
  fileName: string,
): string {
  const cleaned = fileName.replace(/[\r\n\\"]/g, "").trim() || "download";
  const ascii = toAsciiFileName(cleaned).replace(/"/g, "");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(cleaned)}`;
}

/**
 * A header value that can carry any text: always percent-encoded, so readers
 * always `decodeURIComponent` it (a plain name containing "%" stays intact).
 */
export function headerSafe(value: string): string {
  return encodeURIComponent(value);
}

const PERMISSION_DENIED_MESSAGE = "You don't have permission to do that.";

/**
 * The error response for a file/PDF route. Only real auth failures are
 * 401/403 — everything else (a PDF that failed to build, a missing file) was
 * also reported as "Unauthorized", which hid real bugs; those now log to the
 * server output and return 500 with the reason.
 */
export function fileRouteErrorResponse(
  error: unknown,
  context: string,
): NextResponse {
  if (isNextRedirectError(error)) {
    // requireAuth redirects when the session is gone.
    return new NextResponse("Your session has ended — sign in again.", {
      status: 401,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message === PERMISSION_DENIED_MESSAGE) {
    return new NextResponse(message, { status: 403 });
  }
  console.error(`[${context}]`, error);
  return new NextResponse(`${context} failed: ${message}`, { status: 500 });
}
