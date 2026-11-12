"use client";

import type { SaveDeliveryTicketInput } from "@/app/delivery-tickets/actions";
import { renderDeliveryTicketDraftPreview } from "@/app/delivery-tickets/preview-actions";
import { LivePdfPreview } from "@/components/common/live-pdf-preview";
import type { DeliveryTicketDraftPreviewInput } from "@/lib/delivery-ticket-draft-preview";

type TicketLivePreviewProps = {
  /** The ticket being edited; undefined while creating a new one. */
  ticketId?: string;
  ticketNumber?: string | null;
  /** What Save would send right now (the editor's buildPayload). */
  payload: SaveDeliveryTicketInput;
  onHide: () => void;
};

function loadTicketPreview(requestKey: string) {
  return renderDeliveryTicketDraftPreview(JSON.parse(requestKey));
}

/**
 * Only what prints on the ticket goes into the request, so changes that never
 * reach the paper (payment, prices, status) don't refill the PDF.
 */
function toPreviewInput(
  ticketId: string | undefined,
  payload: SaveDeliveryTicketInput,
): DeliveryTicketDraftPreviewInput {
  const isWalkIn = payload.ticketType === "WALK_IN";
  return {
    ticketId: ticketId ?? null,
    ticketType: isWalkIn ? "WALK_IN" : "JOB",
    fulfillmentMethod:
      isWalkIn || payload.fulfillmentMethod === "PICKUP" ? "PICKUP" : "DELIVERY",
    jobId: payload.jobId ?? null,
    quoteId: payload.quoteId ?? null,
    customerId: payload.customerId ?? null,
    jobNumber: payload.jobNumber ?? null,
    customerName: payload.customerName,
    projectName: payload.projectName,
    deliveryDate: payload.deliveryDate ?? null,
    driver: payload.driver ?? null,
    trailer: payload.trailer ?? null,
    customLine: payload.customLine ?? null,
    lines: payload.lines.map((line) => ({
      productId: line.productId ?? null,
      jobStructureId: line.jobStructureId ?? null,
      itemCode: line.itemCode,
      description: line.description ?? null,
      quantity: line.quantity,
      unit: line.unit ?? "EA",
      weightEach: line.weightEach ?? null,
    })),
  };
}

/**
 * The ticket PDF as it will print, beside the editor: the same template fill
 * a saved ticket gets, run on what is on screen and refilled as it changes.
 */
export function TicketLivePreview({
  ticketId,
  ticketNumber = null,
  payload,
  onHide,
}: TicketLivePreviewProps) {
  // A job ticket prints nothing useful until a job is picked.
  const hasSubject = payload.ticketType === "WALK_IN" || Boolean(payload.jobId);
  const requestKey = hasSubject
    ? JSON.stringify(toPreviewInput(ticketId, payload))
    : null;
  const isPickup =
    payload.ticketType === "WALK_IN" || payload.fulfillmentMethod === "PICKUP";

  return (
    <LivePdfPreview
      title={isPickup ? "Pickup ticket PDF" : "Delivery ticket PDF"}
      subject={ticketNumber ?? "New ticket"}
      requestKey={requestKey}
      load={loadTicketPreview}
      emptyNote="Pick a job to see the ticket here."
      loadingNote="Filling the ticket…"
      actions={
        <button
          type="button"
          onClick={onHide}
          title="Hide the ticket preview and give the inputs the whole width"
          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Hide preview
        </button>
      }
    />
  );
}
