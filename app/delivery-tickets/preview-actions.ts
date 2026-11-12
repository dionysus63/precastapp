"use server";

import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  loadDraftTicketForPdf,
  parseDraftPreviewInput,
} from "@/lib/delivery-ticket-draft-preview";
import { generateDeliveryTicketCopyPdfBytes } from "@/lib/delivery-ticket-pdf-fill";
import { withDatabaseRetry } from "@/lib/prisma";
import { returnActionError } from "@/lib/server/action-errors";

export type DeliveryTicketDraftPreviewResult = {
  /** The first copy of the filled ticket PDF, base64 encoded. */
  pdfBase64: string;
};

/**
 * Fills the real ticket PDF from what is on the ticket editor screen, so the
 * editor can show the ticket as it will print while it is being built. Same
 * template fill as a saved ticket; nothing is stored and no ticket number is
 * taken. Only the first copy is filled: the other two differ by their copy
 * title alone.
 */
export async function renderDeliveryTicketDraftPreview(input: unknown) {
  return returnActionError(
    async (): Promise<DeliveryTicketDraftPreviewResult> => {
      await requirePermission(AppPermission.DELIVERY_MANAGE);
      const draft = parseDraftPreviewInput(input);
      const ticket = await withDatabaseRetry((client) =>
        loadDraftTicketForPdf(client, draft),
      );
      const pdfBytes = await generateDeliveryTicketCopyPdfBytes(ticket, 1);
      return { pdfBase64: Buffer.from(pdfBytes).toString("base64") };
    },
  );
}
