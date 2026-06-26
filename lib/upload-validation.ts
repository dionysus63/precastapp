import path from "path";

/** Hard cap on a single uploaded file (50 MB). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Extensions accepted for job, product, and structure document uploads. Kept
 * intentionally narrow: drawings, common office docs, images, and archives.
 */
export const DOCUMENT_UPLOAD_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".tif",
  ".tiff",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".dwg",
  ".dxf",
  ".zip",
] as const;

/**
 * Reject empty, oversized, or disallowed-extension uploads before any bytes
 * are written to disk. Centralizing this keeps every upload entry point on the
 * same size cap and allowlist.
 */
export function assertUploadAllowed(
  file: File,
  options?: { maxBytes?: number; allowedExtensions?: readonly string[] },
): void {
  const maxBytes = options?.maxBytes ?? MAX_UPLOAD_BYTES;
  const allowed = options?.allowedExtensions ?? DOCUMENT_UPLOAD_EXTENSIONS;

  if (!file || file.size <= 0) {
    throw new Error("The uploaded file is empty.");
  }

  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`File is too large. The maximum upload size is ${mb} MB.`);
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ext || !allowed.includes(ext)) {
    throw new Error(
      `File type "${ext || "unknown"}" is not allowed. Allowed types: ${allowed.join(", ")}.`,
    );
  }
}
