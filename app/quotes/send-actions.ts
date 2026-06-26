"use server";

import { revalidatePath } from "next/cache";
import { AppPermission } from "@/app/generated/prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { requirePermission } from "@/lib/auth/session";
import {
  buildDefaultQuoteEmailMessage,
  buildDefaultQuoteEmailSubject,
  buildQuoteEmailHtml,
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

    const [company, subject, messageBody] = await Promise.all([
      getCompanyProfile(),
      input.subject?.trim()
        ? Promise.resolve(input.subject.trim())
        : buildDefaultQuoteEmailSubject(quote),
      input.message?.trim()
        ? Promise.resolve(input.message.trim())
        : buildDefaultQuoteEmailMessage(quote),
    ]);

    const persisted = await withDatabaseRetry((client) =>
      buildAndPersistQuotePdf(quote, jobFolderPath, client),
    );

    const to = parseEmailList(input.to).join(", ");
    const cc = input.cc?.trim()
      ? parseEmailList(input.cc).join(", ")
      : undefined;

    await sendMail({
      to,
      cc,
      subject,
      text: messageBody,
      html: buildQuoteEmailHtml(messageBody),
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

export async function getSendQuoteEmailConfigured(): Promise<boolean> {
  await requirePermission(AppPermission.QUOTES_MANAGE);
  return isEmailConfigured();
}

export type SendQuoteDefaults = {
  to: string;
  subject: string;
  message: string;
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

  const [subject, message] = await Promise.all([
    buildDefaultQuoteEmailSubject(quote),
    buildDefaultQuoteEmailMessage(quote),
  ]);

  return {
    to: quote.contactEmail?.trim() ?? "",
    subject,
    message,
  };
}
