import { randomUUID } from "crypto";

export type QuoteDraftEmlInput = {
  to: string;
  cc?: string;
  subject: string;
  message: string;
  attachmentFilename: string;
  pdfBytes: Uint8Array;
};

/** Base64 with 76-char lines per MIME. */
function base64Lines(bytes: Uint8Array): string {
  const encoded = Buffer.from(bytes).toString("base64");
  const lines: string[] = [];
  for (let i = 0; i < encoded.length; i += 76) {
    lines.push(encoded.slice(i, i + 76));
  }
  return lines.join("\r\n");
}

/** RFC 2047 encoded-word so subjects with any characters survive. */
function encodeHeaderText(value: string): string {
  return `=?utf-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[\r\n"]/g, "_");
}

/**
 * Build an Outlook-openable draft email (.eml) with the quote PDF attached.
 * The X-Unsent header makes classic Outlook open it in compose mode instead
 * of as a received message.
 */
export function buildQuoteDraftEml(input: QuoteDraftEmlInput): string {
  const boundary = `----precast_${randomUUID().replace(/-/g, "")}`;
  const filename = sanitizeFilename(input.attachmentFilename);

  const headers = [
    "X-Unsent: 1",
    `To: ${input.to}`,
    ...(input.cc?.trim() ? [`Cc: ${input.cc.trim()}`] : []),
    `Subject: ${encodeHeaderText(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const parts = [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(Buffer.from(input.message, "utf8")),
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(input.pdfBytes),
    "",
    `--${boundary}--`,
    "",
  ];

  return parts.join("\r\n");
}
