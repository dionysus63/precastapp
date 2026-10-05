import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// sendQuote runs real: session + permission check, quote lookup, status
// claim/revert, real PDF generation, the mail helper, and the audit log.
// Mocked: the request-scoped cookie store, next/cache, the nodemailer
// transport (no SMTP traffic), and the two fs writes that would drop the PDF
// into the office's quote folder (mkdir + the .pdf writeFile).
const hoisted = vi.hoisted(() => ({
  token: "",
  sendMail: null as unknown as import("vitest").Mock,
  createTransport: null as unknown as import("vitest").Mock,
  writtenPdfPaths: [] as string[],
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "precastapp_session" && hoisted.token
        ? { name, value: hoisted.token }
        : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(async () => new Headers({ host: "precast.test" })),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("nodemailer", async () => {
  const { vi: v } = await import("vitest");
  hoisted.sendMail = v.fn();
  hoisted.createTransport = v.fn(() => ({ sendMail: hoisted.sendMail }));
  return {
    default: { createTransport: hoisted.createTransport },
    createTransport: hoisted.createTransport,
  };
});
vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  const writeFile: typeof actual.writeFile = async (file, data, options) => {
    if (String(file).toLowerCase().endsWith(".pdf")) {
      hoisted.writtenPdfPaths.push(String(file));
      return;
    }
    return actual.writeFile(file, data, options);
  };
  const mkdir = (async () => undefined) as unknown as typeof actual.mkdir;
  return { ...actual, default: { ...actual, writeFile, mkdir }, writeFile, mkdir };
});

import { sendQuote } from "@/app/quotes/send-actions";
import { getCompanyProfile } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";

const tag = `QSEND-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const SMTP_ENV = {
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "2525",
  SMTP_USER: "quote-bot",
  SMTP_PASSWORD: "test-only-not-a-secret",
  SMTP_FROM: "quotes@example.test",
};
const savedEnv: Record<string, string | undefined> = {};

let estimatorId: string;
let viewerId: string;
let estimatorToken: string;
let viewerToken: string;
let customerId: string;
let quoteCounter = 0;

async function createQuote(
  status: "DRAFT" | "IN_REVIEW" | "SENT" = "DRAFT",
  sentAt: Date | null = null,
) {
  quoteCounter += 1;
  return prisma.quote.create({
    data: {
      quoteNumber: `${tag}-Q${quoteCounter}`,
      customerId,
      customerName: `${tag} Builders LLC`,
      projectName: "Main Street Drainage",
      contactEmail: "estimating@builders.example",
      status,
      sentAt,
      subtotal: 1500,
      total: 1500,
      lineItems: {
        create: [
          {
            lineNumber: 1,
            sortOrder: 1,
            lineType: "CUSTOM_STRUCTURE",
            itemCode: "MH-48",
            description: "48in manhole",
            quantity: 1,
            unit: "EA",
            unitPrice: 1500,
            total: 1500,
          },
        ],
      },
    },
  });
}

beforeAll(async () => {
  for (const [key, value] of Object.entries(SMTP_ENV)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }

  const estimator = await prisma.user.create({
    data: {
      username: `${tag}-estimator`.toLowerCase(),
      displayName: `${tag} Estimator`,
      initials: "QE",
      role: "ESTIMATOR",
      grantedPermissions: ["QUOTES_MANAGE"],
    },
  });
  estimatorId = estimator.id;
  const viewer = await prisma.user.create({
    data: {
      username: `${tag}-viewer`.toLowerCase(),
      displayName: `${tag} Viewer`,
      initials: "QV",
      role: "READ_ONLY",
      deniedPermissions: ["QUOTES_MANAGE"],
    },
  });
  viewerId = viewer.id;

  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  estimatorToken = `${tag}-estimator-token`;
  viewerToken = `${tag}-viewer-token`;
  await prisma.session.createMany({
    data: [
      { id: `${tag}-est-sess`, token: estimatorToken, userId: estimatorId, expiresAt },
      { id: `${tag}-view-sess`, token: viewerToken, userId: viewerId, expiresAt },
    ],
  });

  customerId = (
    await prisma.customer.create({
      data: { name: `${tag} Builders LLC`, nickname: "Builders" },
    })
  ).id;
});

beforeEach(() => {
  hoisted.token = estimatorToken;
  hoisted.writtenPdfPaths = [];
  hoisted.sendMail.mockReset();
  hoisted.sendMail.mockResolvedValue({ messageId: "<test@example.test>" });
});

afterAll(async () => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  await prisma.quote.deleteMany({ where: { quoteNumber: { startsWith: tag } } });
  await prisma.customer.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: [estimatorId, viewerId] } } });
  await prisma.session.deleteMany({ where: { userId: { in: [estimatorId, viewerId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [estimatorId, viewerId] } } });
  await prisma.$disconnect();
});

describe("sendQuote", () => {
  it("emails the PDF to the parsed recipients and marks a draft SENT", async () => {
    const quote = await createQuote("DRAFT");
    const company = await getCompanyProfile();

    const result = await sendQuote(quote.id, {
      to: " gc@builders.example ; pm@builders.example ",
      cc: "office@builders.example",
      subject: "  Quote for Main Street  ",
      message: "Please find our quote attached.",
    });

    expect(result).toMatchObject({
      success: true,
      sentTo: "gc@builders.example, pm@builders.example",
    });
    expect(hoisted.writtenPdfPaths).toHaveLength(1);
    expect(result).toMatchObject({ filePath: hoisted.writtenPdfPaths[0] });

    expect(hoisted.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: SMTP_ENV.SMTP_HOST,
        port: 2525,
        auth: { user: SMTP_ENV.SMTP_USER, pass: SMTP_ENV.SMTP_PASSWORD },
      }),
    );
    expect(hoisted.sendMail).toHaveBeenCalledTimes(1);
    const mail = hoisted.sendMail.mock.calls[0][0];
    expect(mail).toMatchObject({
      to: "gc@builders.example, pm@builders.example",
      cc: "office@builders.example",
      subject: "Quote for Main Street",
      from: `"${company.name.replace(/"/g, "")}" <${SMTP_ENV.SMTP_FROM}>`,
    });
    if (company.email.trim()) {
      expect(mail.replyTo).toBe(company.email.trim());
    }
    expect(mail.text).toContain("Please find our quote attached.");
    expect(mail.html).toContain("Please find our quote attached.");

    // One PDF attachment named for the contractor's nickname + job.
    expect(mail.attachments).toHaveLength(1);
    const [attachment] = mail.attachments;
    expect(attachment.filename).toBe("Builders - Main Street Drainage.pdf");
    expect(attachment.contentType).toBe("application/pdf");
    expect(Buffer.isBuffer(attachment.content)).toBe(true);
    expect(attachment.content.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const saved = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(saved.status).toBe("SENT");
    expect(saved.sentAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: quote.id, action: "quote.sent" },
    });
    expect(audit?.userId).toBe(estimatorId);
  });

  it("falls back to the default subject when none is given", async () => {
    const quote = await createQuote("IN_REVIEW");
    const result = await sendQuote(quote.id, { to: "gc@builders.example" });
    expect(result).toMatchObject({ success: true });

    const mail = hoisted.sendMail.mock.calls[0][0];
    expect(typeof mail.subject).toBe("string");
    expect(mail.subject.trim()).not.toBe("");
    expect(mail.cc).toBeUndefined();
    expect(
      (await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status,
    ).toBe("SENT");
  });

  it("returns the SMTP error and leaves a draft unsent", async () => {
    const quote = await createQuote("DRAFT");
    hoisted.sendMail.mockRejectedValueOnce(
      new Error("550 5.1.1 Recipient address rejected"),
    );

    const result = await sendQuote(quote.id, {
      to: "gc@builders.example",
      subject: "Quote",
      message: "Hi",
    });

    expect(result).toEqual({
      success: false,
      error: "550 5.1.1 Recipient address rejected",
    });
    expect(hoisted.sendMail).toHaveBeenCalledTimes(1);
    const saved = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(saved.status).toBe("DRAFT");
    expect(saved.sentAt).toBeNull();
    expect(
      await prisma.auditLog.count({ where: { entityId: quote.id, action: "quote.sent" } }),
    ).toBe(0);
  });

  it("an SMTP failure on a resend keeps the quote SENT with its original sentAt", async () => {
    const originalSentAt = new Date("2026-09-01T15:00:00.000Z");
    const quote = await createQuote("SENT", originalSentAt);
    hoisted.sendMail.mockRejectedValueOnce(new Error("Connection timeout"));

    const result = await sendQuote(quote.id, { to: "gc@builders.example" });

    expect(result).toEqual({ success: false, error: "Connection timeout" });
    const saved = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(saved.status).toBe("SENT");
    expect(saved.sentAt?.toISOString()).toBe(originalSentAt.toISOString());
  });

  it("rejects invalid recipients before touching the quote or SMTP", async () => {
    const quote = await createQuote("DRAFT");

    expect(await sendQuote(quote.id, { to: "gc@builders.example, nope" })).toEqual({
      success: false,
      error: "Invalid recipient email: nope",
    });
    expect(await sendQuote(quote.id, { to: "   " })).toEqual({
      success: false,
      error: "Recipient email is required.",
    });
    expect(
      await sendQuote(quote.id, { to: "gc@builders.example", cc: "bad cc" }),
    ).toEqual({ success: false, error: "Invalid CC email: bad cc" });

    expect(hoisted.sendMail).not.toHaveBeenCalled();
    expect(
      (await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status,
    ).toBe("DRAFT");
  });

  it("refuses when SMTP is not configured and leaves the status alone", async () => {
    const quote = await createQuote("DRAFT");
    const savedFrom = process.env.SMTP_FROM;
    delete process.env.SMTP_FROM;
    try {
      const result = await sendQuote(quote.id, { to: "gc@builders.example" });
      expect(result).toMatchObject({
        success: false,
        error: expect.stringMatching(/Email is not configured/),
      });
    } finally {
      process.env.SMTP_FROM = savedFrom;
    }
    expect(hoisted.sendMail).not.toHaveBeenCalled();
    expect(
      (await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status,
    ).toBe("DRAFT");
  });

  it("refuses a quote with no line items without claiming it", async () => {
    const quote = await createQuote("DRAFT");
    await prisma.quoteLineItem.deleteMany({ where: { quoteId: quote.id } });

    expect(await sendQuote(quote.id, { to: "gc@builders.example" })).toEqual({
      success: false,
      error: "Add at least one line item before sending.",
    });
    expect(hoisted.sendMail).not.toHaveBeenCalled();
    expect(
      (await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status,
    ).toBe("DRAFT");
  });

  it("throws a permission error for a user without QUOTES_MANAGE and sends nothing", async () => {
    // Unlike the validation failures above, the permission check sits outside
    // sendQuote's try/catch, so it rejects instead of returning { success: false }.
    const quote = await createQuote("DRAFT");
    hoisted.token = viewerToken;

    await expect(
      sendQuote(quote.id, { to: "gc@builders.example" }),
    ).rejects.toThrow("You don't have permission to do that.");
    expect(hoisted.sendMail).not.toHaveBeenCalled();
    expect(
      (await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status,
    ).toBe("DRAFT");
  });
});
