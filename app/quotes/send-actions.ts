"use server";

import { writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import { buildQuoteDraftEml } from "@/lib/email/outlook-draft";
import { launchWindowsFileWithDefaultApp } from "@/lib/windows-explorer";
import {
  buildDefaultQuoteEmailMessage,
  buildDefaultQuoteEmailSubject,
  buildQuoteEmailHtml,
  buildSignatureText,
  getQuoteEmailStyle,
} from "@/lib/email/quote-email";
import {
  isEmailConfigured,
  isValidEmail,
  parseEmailList,
  sendMail,
} from "@/lib/email/mailer";
import { getCompanyProfile } from "@/lib/app-settings";
import { QUOTE_PDF_INCLUDE } from "@/lib/quote-pdf-data";
import { buildAndPersistQuotePdf } from "@/lib/quote-pdf-persist";
import { withDatabaseRetry } from "@/lib/prisma";
import { canSendQuote } from "@/lib/quotes/send-rules";
import type { QuoteStatus } from "@/lib/quotes/types";

export type SendQuoteInput = {
  to: string;
  cc?: string;
  subject?: string;
  message?: string;
};

export type SendQuoteResult =
  | { success: true; sentTo: string; filePath: string }
  | { success: false; error: string };

async function findSupersededBy(quote: {
  id: string;
  status: string;
  originalQuoteId: string | null;
  revisionNumber: number;
}) {
  if (quote.status !== "REVISED") {
    return null;
  }

  const rootId = quote.originalQuoteId ?? quote.id;
  return withDatabaseRetry((client) =>
    client.quote.findFirst({
      where: {
        OR: [{ id: rootId }, { originalQuoteId: rootId }],
        revisionNumber: { gt: quote.revisionNumber },
      },
      orderBy: { revisionNumber: "asc" },
      select: { id: true },
    }),
  );
}

function validateSendQuoteInput(input: SendQuoteInput): string | null {
  const to = input.to.trim();
  if (!to) {
    return "Recipient email is required.";
  }

  for (const email of parseEmailList(to)) {
    if (!isValidEmail(email)) {
      return `Invalid recipient email: ${email}`;
    }
  }

  if (input.cc?.trim()) {
    for (const email of parseEmailList(input.cc)) {
      if (!isValidEmail(email)) {
        return `Invalid CC email: ${email}`;
      }
    }
  }

  if (input.subject?.trim() === "") {
    return "Subject cannot be empty.";
  }

  if (input.message?.trim() === "") {
    return "Message cannot be empty.";
  }

  return null;
}

export async function sendQuote(
  quoteId: string,
  input: SendQuoteInput,
): Promise<SendQuoteResult> {
  const user = await requirePermission(AppPermission.QUOTES_MANAGE);

  if (!quoteId.trim()) {
    return { success: false, error: "Quote id is required." };
  }

  if (!isEmailConfigured()) {
    return {
      success: false,
      error:
        "Email is not configured. Set SMTP_USER, SMTP_PASSWORD, and SMTP_FROM in .env.",
    };
  }

  const validationError = validateSendQuoteInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const quote = await withDatabaseRetry((client) =>
      client.quote.findUnique({
        where: { id: quoteId },
        include: QUOTE_PDF_INCLUDE,
      }),
    );

    if (!quote) {
      return { success: false, error: "Quote not found." };
    }

    const supersededBy = await findSupersededBy(quote);
    if (supersededBy) {
      return {
        success: false,
        error: "This quote was superseded by a newer revision and cannot be sent.",
      };
    }

    const status = quote.status as QuoteStatus;
    if (!canSendQuote(status, supersededBy)) {
      return {
        success: false,
        error: `Quotes with status "${status}" cannot be sent.`,
      };
    }

    if (quote.lineItems.length === 0) {
      return { success: false, error: "Add at least one line item before sending." };
    }

    // First-send claim (double-click / two-tab guard): atomically flip
    // DRAFT/IN_REVIEW → SENT before emailing, so only one concurrent sender
    // proceeds. Reverted below if the email fails. Explicit resends
    // (status already SENT) are intentionally allowed through.
    const isFirstSend = status !== "SENT";
    if (isFirstSend) {
      const claimed = await withDatabaseRetry((client) =>
        client.quote.updateMany({
          where: { id: quoteId, status: { in: ["DRAFT", "IN_REVIEW"] } },
          data: { status: "SENT", sentAt: new Date() },
        }),
      );
      if (claimed.count === 0) {
        return {
          success: false,
          error:
            "This quote was just sent by someone else. Refresh the page to see its current status.",
        };
      }
    }

    let jobFolderPath: string | null = null;
    if (quote.jobId) {
      const job = await withDatabaseRetry((client) =>
        client.job.findUnique({
          where: { id: quote.jobId! },
          select: { folderPath: true },
        }),
      );
      jobFolderPath = job?.folderPath ?? null;
    }

    const [company, subject, messageBody, emailStyle] = await Promise.all([
      getCompanyProfile(),
      input.subject?.trim()
        ? Promise.resolve(input.subject.trim())
        : buildDefaultQuoteEmailSubject(quote),
      input.message?.trim()
        ? Promise.resolve(input.message.trim())
        : buildDefaultQuoteEmailMessage(quote),
      getQuoteEmailStyle(),
    ]);
    const signatureText = buildSignatureText(emailStyle.signature);
    const textWithSignature = signatureText
      ? `${messageBody}\n\n${signatureText}`
      : messageBody;

    const to = parseEmailList(input.to).join(", ");
    const cc = input.cc?.trim()
      ? parseEmailList(input.cc).join(", ")
      : undefined;

    let persisted: Awaited<ReturnType<typeof buildAndPersistQuotePdf>>;
    try {
      persisted = await withDatabaseRetry((client) =>
        buildAndPersistQuotePdf(quote, jobFolderPath, client),
      );

      await sendMail({
        to,
        cc,
        subject,
        text: textWithSignature,
        html: buildQuoteEmailHtml(messageBody, emailStyle),
        replyTo: company.email,
        fromName: company.name,
        attachments: [
          {
            filename: persisted.attachmentFilename,
            content: Buffer.from(persisted.bytes),
            contentType: "application/pdf",
          },
        ],
      });
    } catch (error) {
      // The email did not go out — release the first-send claim so the
      // quote doesn't sit in SENT without a sent email (best effort).
      if (isFirstSend) {
        await withDatabaseRetry((client) =>
          client.quote.updateMany({
            where: { id: quoteId, status: "SENT" },
            data: { status, sentAt: quote.sentAt },
          }),
        ).catch(() => undefined);
      }
      throw error;
    }

    await withDatabaseRetry(async (client) => {
      const existing = await client.quote.findUnique({
        where: { id: quoteId },
        select: { sentAt: true },
      });

      await client.quote.update({
        where: { id: quoteId },
        data: {
          status: "SENT",
          ...(existing?.sentAt ? {} : { sentAt: new Date() }),
        },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: "quote.sent",
      entityType: "Quote",
      entityId: quoteId,
      summary: `${user.displayName} sent quote ${quote.quoteNumber} to ${to}`,
      metadata: {
        to,
        cc: cc ?? null,
        subject,
        filePath: persisted.outputPath,
      },
    });

    revalidatePath("/quotes");
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath(`/quotes/${quoteId}/preview`);

    return {
      success: true,
      sentTo: to,
      filePath: persisted.outputPath,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to send quote email.",
    };
  }
}

export type OpenOutlookDraftResult =
  | { success: true; to: string; draftPath: string }
  | { success: false; error: string };

/**
 * Build the quote PDF, wrap it in an Outlook draft (.eml with X-Unsent), and
 * open it with the default mail app. Marks the quote Sent optimistically —
 * the user reviews and actually sends from Outlook.
 */
export async function openQuoteInOutlook(
  quoteId: string,
  input: SendQuoteInput,
): Promise<OpenOutlookDraftResult> {
  const user = await requirePermission(AppPermission.QUOTES_MANAGE);

  if (!quoteId.trim()) {
    return { success: false, error: "Quote id is required." };
  }

  const validationError = validateSendQuoteInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const quote = await withDatabaseRetry((client) =>
      client.quote.findUnique({
        where: { id: quoteId },
        include: QUOTE_PDF_INCLUDE,
      }),
    );

    if (!quote) {
      return { success: false, error: "Quote not found." };
    }

    const supersededBy = await findSupersededBy(quote);
    if (supersededBy) {
      return {
        success: false,
        error: "This quote was superseded by a newer revision and cannot be sent.",
      };
    }

    const status = quote.status as QuoteStatus;
    if (!canSendQuote(status, supersededBy)) {
      return {
        success: false,
        error: `Quotes with status "${status}" cannot be sent.`,
      };
    }

    if (quote.lineItems.length === 0) {
      return { success: false, error: "Add at least one line item before sending." };
    }

    // Same first-send claim as sendQuote: atomically flip DRAFT/IN_REVIEW →
    // SENT so two people can't both prepare a first send. Reverted below if
    // the draft cannot be created or opened.
    const isFirstSend = status !== "SENT";
    if (isFirstSend) {
      const claimed = await withDatabaseRetry((client) =>
        client.quote.updateMany({
          where: { id: quoteId, status: { in: ["DRAFT", "IN_REVIEW"] } },
          data: { status: "SENT", sentAt: new Date() },
        }),
      );
      if (claimed.count === 0) {
        return {
          success: false,
          error:
            "This quote was just sent by someone else. Refresh the page to see its current status.",
        };
      }
    }

    try {
      let jobFolderPath: string | null = null;
      if (quote.jobId) {
        const job = await withDatabaseRetry((client) =>
          client.job.findUnique({
            where: { id: quote.jobId! },
            select: { folderPath: true },
          }),
        );
        jobFolderPath = job?.folderPath ?? null;
      }

      const [subject, messageBody, emailStyle] = await Promise.all([
        input.subject?.trim()
          ? Promise.resolve(input.subject.trim())
          : buildDefaultQuoteEmailSubject(quote),
        input.message?.trim()
          ? Promise.resolve(input.message.trim())
          : buildDefaultQuoteEmailMessage(quote),
        getQuoteEmailStyle(),
      ]);
      const signatureText = buildSignatureText(emailStyle.signature);

      const to = parseEmailList(input.to).join(", ");
      const cc = input.cc?.trim()
        ? parseEmailList(input.cc).join(", ")
        : undefined;

      const persisted = await withDatabaseRetry((client) =>
        buildAndPersistQuotePdf(quote, jobFolderPath, client),
      );

      const eml = buildQuoteDraftEml({
        to,
        cc,
        subject,
        message: signatureText
          ? `${messageBody}\n\n${signatureText}`
          : messageBody,
        html: buildQuoteEmailHtml(messageBody, emailStyle),
        attachmentFilename: persisted.attachmentFilename,
        pdfBytes: persisted.bytes,
      });
      const draftPath = persisted.outputPath.replace(/\.pdf$/i, "") + ".eml";
      await writeFile(draftPath, eml, "utf8");

      // The draft path derives from our own PDF persist step (not user
      // input), so scope the launch guard to its own directory — non-job
      // quotes persist outside the jobs root.
      await launchWindowsFileWithDefaultApp(draftPath, {
        allowedRoot: path.dirname(draftPath),
      });

      await writeAuditLog({
        userId: user.id,
        action: "quote.sent",
        entityType: "Quote",
        entityId: quoteId,
        summary: `${user.displayName} prepared Outlook draft for quote ${quote.quoteNumber} to ${to}`,
        metadata: {
          method: "outlook-draft",
          to,
          cc: cc ?? null,
          subject,
          filePath: draftPath,
        },
      });

      revalidatePath("/quotes");
      revalidatePath(`/quotes/${quoteId}`);
      revalidatePath(`/quotes/${quoteId}/preview`);

      return { success: true, to, draftPath };
    } catch (error) {
      // Draft never opened — release the first-send claim (best effort).
      if (isFirstSend) {
        await withDatabaseRetry((client) =>
          client.quote.updateMany({
            where: { id: quoteId, status: "SENT" },
            data: { status, sentAt: quote.sentAt },
          }),
        ).catch(() => undefined);
      }
      throw error;
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to open the Outlook draft.",
    };
  }
}

export async function getSendQuoteEmailConfigured(): Promise<boolean> {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  return isEmailConfigured();
}

export type SendQuoteRecipientOption = {
  id: string;
  name: string;
  title: string;
  email: string;
  isPrimary: boolean;
};

export type SendQuoteDefaults = {
  to: string;
  subject: string;
  message: string;
  /** Customer contacts with an email address, for the recipient picker. */
  contacts: SendQuoteRecipientOption[];
};

export async function getSendQuoteDefaults(
  quoteId: string,
): Promise<SendQuoteDefaults | { error: string }> {
  await requirePermission(AppPermission.QUOTES_MANAGE);

  const quote = await withDatabaseRetry((client) =>
    client.quote.findUnique({
      where: { id: quoteId },
      include: QUOTE_PDF_INCLUDE,
    }),
  );

  if (!quote) {
    return { error: "Quote not found." };
  }

  const [subject, message, contactRecords] = await Promise.all([
    buildDefaultQuoteEmailSubject(quote),
    buildDefaultQuoteEmailMessage(quote),
    quote.customerId
      ? withDatabaseRetry((client) =>
          client.contact.findMany({
            where: { customerId: quote.customerId!, email: { not: null } },
            orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              title: true,
              email: true,
              isPrimary: true,
            },
          }),
        )
      : Promise.resolve([]),
  ]);

  return {
    to: quote.contactEmail?.trim() ?? "",
    subject,
    message,
    contacts: contactRecords
      .filter((contact) => contact.email?.trim())
      .map((contact) => ({
        id: contact.id,
        name: contact.name,
        title: contact.title ?? "",
        email: contact.email!.trim(),
        isPrimary: contact.isPrimary,
      })),
  };
}
