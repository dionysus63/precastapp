"use server";

import { AppPermission } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import {
  loadDraftPurchaseOrderForPdf,
  parsePurchaseOrderDraftPreviewInput,
} from "@/lib/purchase-order-draft-preview";
import { generatePurchaseOrderPdfBytes } from "@/lib/purchase-order-pdf-data";
import { withDatabaseRetry } from "@/lib/prisma";
import { returnActionError } from "@/lib/server/action-errors";

export type PurchaseOrderDraftPreviewResult = {
  /** The purchase order PDF, base64 encoded. */
  pdfBase64: string;
  /** The number printed on it: the saved one, or the one a save would give. */
  poNumber: string;
};

/**
 * Draws the purchase order PDF from what is on the editor screen, so the
 * editor can show the order as it will print while it is being typed. Same
 * drawing as a saved purchase order; nothing is stored and no number is taken.
 */
export async function renderPurchaseOrderDraftPreview(input: unknown) {
  return returnActionError(async (): Promise<PurchaseOrderDraftPreviewResult> => {
    await requirePermission(AppPermission.INVENTORY_MANAGE);
    const draft = parsePurchaseOrderDraftPreviewInput(input);
    const purchaseOrder = await withDatabaseRetry((client) =>
      loadDraftPurchaseOrderForPdf(client, draft),
    );
    const pdfBytes = await generatePurchaseOrderPdfBytes(purchaseOrder);
    return {
      pdfBase64: Buffer.from(pdfBytes).toString("base64"),
      poNumber: purchaseOrder.poNumber,
    };
  });
}
