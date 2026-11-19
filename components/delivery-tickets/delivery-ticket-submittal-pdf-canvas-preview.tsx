"use client";

import { PdfPageCanvas } from "@/components/common/pdf-page-canvas";
import type { PdfZoom } from "@/lib/preview-zoom";

type DeliveryTicketSubmittalPdfCanvasPreviewProps = {
  ticketId: string;
  activeSheet: number;
  /** How far the paper is zoomed in; 1 is fitted. */
  zoom?: PdfZoom;
  onSheetCountChange?: (count: number) => void;
};

export function DeliveryTicketSubmittalPdfCanvasPreview({
  ticketId,
  activeSheet,
  zoom,
  onSheetCountChange,
}: DeliveryTicketSubmittalPdfCanvasPreviewProps) {
  return (
    <PdfPageCanvas
      url={getDeliveryTicketSubmittalPreviewPrintUrl(ticketId)}
      activeSheet={activeSheet}
      zoom={zoom}
      onSheetCountChange={onSheetCountChange}
      // Submittal documents mix portrait and landscape pages; the frame
      // follows the active page's own dimensions.
      followPageShape
      loadErrorText="Could not load submittal package PDF."
    />
  );
}

export function getDeliveryTicketSubmittalPreviewPrintUrl(ticketId: string): string {
  return `/api/delivery-tickets/${ticketId}/submittals/preview`;
}
