"use server";

import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  buildDraftQuoteForPdf,
  parseQuoteDraftPreviewInput,
} from "@/lib/quote-draft-preview";
import { generateQuotePdfBytes } from "@/lib/quote-pdf-fill";
import { returnActionError } from "@/lib/server/action-errors";

export type QuoteDraftPreviewResult = {
  /** The filled quote PDF (every page), base64 encoded. */
  pdfBase64: string;
};

/**
 * Fills the real quote PDF from what is on the quote form, so the form can
 * show the quote as it will print while it is being built. Same template
 * fill as a saved quote; nothing is stored and no quote number is taken.
 */
export async function renderQuoteDraftPreview(input: unknown) {
  return returnActionError(async (): Promise<QuoteDraftPreviewResult> => {
    await requirePermission(AppPermission.QUOTES_MANAGE);
    const draft = parseQuoteDraftPreviewInput(input);

    // Only an edited quote has something the form does not carry: its
    // revision marker.
    const quoteId = draft.quoteId;
    const saved = quoteId
      ? await withDatabaseRetry((client) =>
          client.quote.findUnique({
            where: { id: quoteId },
            select: { revisionNumber: true },
          }),
        )
      : null;
    if (quoteId && !saved) {
      throw new Error("Quote not found.");
    }

    const pdfBytes = await generateQuotePdfBytes(
      buildDraftQuoteForPdf(draft, saved),
    );
    return { pdfBase64: Buffer.from(pdfBytes).toString("base64") };
  });
}
