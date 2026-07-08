import { describe, expect, it } from "vitest";
import { buildQuoteDraftEml } from "@/lib/email/outlook-draft";

const fakePdf = Buffer.from("%PDF-1.4 test content for roundtrip check 12345");

function buildSample() {
  return buildQuoteDraftEml({
    to: "druiz@example.com, second@example.com",
    cc: "nick@li-precast.com",
    subject: "Quote Q-26-016 — Maple St pump station",
    message: "Hi Dan,\n\nAttached is our quote.\n\nThanks,\nNick",
    attachmentFilename: "Q-26-016.pdf",
    pdfBytes: fakePdf,
  });
}

describe("buildQuoteDraftEml", () => {
  it("starts with X-Unsent so Outlook opens it as a draft", () => {
    expect(buildSample().startsWith("X-Unsent: 1\r\n")).toBe(true);
  });

  it("carries recipients and cc", () => {
    const eml = buildSample();
    expect(eml).toContain("To: druiz@example.com, second@example.com");
    expect(eml).toContain("Cc: nick@li-precast.com");
  });

  it("omits the Cc header when not provided", () => {
    const eml = buildQuoteDraftEml({
      to: "a@b.com",
      subject: "s",
      message: "m",
      attachmentFilename: "q.pdf",
      pdfBytes: fakePdf,
    });
    expect(eml).not.toContain("Cc:");
  });

  it("encodes the subject as an RFC 2047 word that roundtrips", () => {
    const eml = buildSample();
    const match = /Subject: =\?utf-8\?B\?([A-Za-z0-9+/=]+)\?=/.exec(eml);
    expect(match).not.toBeNull();
    expect(Buffer.from(match![1]!, "base64").toString("utf8")).toBe(
      "Quote Q-26-016 — Maple St pump station",
    );
  });

  it("attaches the PDF byte-for-byte", () => {
    const eml = buildSample();
    expect(eml).toContain(
      'Content-Disposition: attachment; filename="Q-26-016.pdf"',
    );

    const blocks = eml.split("Content-Transfer-Encoding: base64\r\n\r\n");
    const pdfBase64 = blocks[2]!.split("\r\n--")[0]!.replace(/\r\n/g, "");
    expect(Buffer.from(pdfBase64, "base64").equals(fakePdf)).toBe(true);
  });

  it("roundtrips the message body through its base64 part", () => {
    const eml = buildSample();
    const blocks = eml.split("Content-Transfer-Encoding: base64\r\n\r\n");
    const bodyBase64 = blocks[1]!.split("\r\n--")[0]!.replace(/\r\n/g, "");
    expect(Buffer.from(bodyBase64, "base64").toString("utf8")).toBe(
      "Hi Dan,\n\nAttached is our quote.\n\nThanks,\nNick",
    );
  });

  it("closes the MIME multipart with a final boundary", () => {
    expect(/--\r\n$/.test(buildSample())).toBe(true);
  });

  it("wraps plain + HTML bodies in multipart/alternative when html is given", () => {
    const eml = buildQuoteDraftEml({
      to: "a@b.com",
      subject: "s",
      message: "Hi Dan",
      html: "<html><body><b>Hi Dan</b></body></html>",
      attachmentFilename: "q.pdf",
      pdfBytes: fakePdf,
    });

    expect(eml).toContain("Content-Type: multipart/alternative;");
    expect(eml).toContain('Content-Type: text/html; charset="utf-8"');

    const blocks = eml.split("Content-Transfer-Encoding: base64\r\n\r\n");
    // Order: [1] plain, [2] html, [3] pdf.
    const plain = Buffer.from(
      blocks[1]!.split("\r\n--")[0]!.replace(/\r\n/g, ""),
      "base64",
    ).toString("utf8");
    const html = Buffer.from(
      blocks[2]!.split("\r\n--")[0]!.replace(/\r\n/g, ""),
      "base64",
    ).toString("utf8");
    const pdf = Buffer.from(
      blocks[3]!.split("\r\n--")[0]!.replace(/\r\n/g, ""),
      "base64",
    );

    expect(plain).toBe("Hi Dan");
    expect(html).toContain("<b>Hi Dan</b>");
    expect(pdf.equals(fakePdf)).toBe(true);
  });

  it("keeps the plain-only layout when html is omitted", () => {
    expect(buildSample()).not.toContain("multipart/alternative");
  });

  it("sanitizes newlines and quotes so filenames cannot forge headers", () => {
    const eml = buildQuoteDraftEml({
      to: "a@b.com",
      subject: "s",
      message: "m",
      attachmentFilename: 'evil"\r\nX-Injected: 1.pdf',
      pdfBytes: fakePdf,
    });
    // The injected text may survive inside the quoted filename, but never as
    // a line of its own (which is what would create a forged header).
    const lines = eml.split("\r\n");
    expect(lines.some((line) => line.startsWith("X-Injected:"))).toBe(false);
    // And the quote character is stripped so the filename attribute can't be
    // closed early.
    expect(eml).toContain('filename="evil___X-Injected: 1.pdf"');
  });
});
