"use client";

import { PdfPageCanvas } from "@/components/common/pdf-page-canvas";
import type { PdfZoom } from "@/lib/preview-zoom";

type DeliveryTicketPdfCanvasPreviewProps = {
  ticketId: string;
  activeCopy: number;
  activeSheet: number;
  /** How far the paper is zoomed in; 1 is fitted. */
  zoom?: PdfZoom;
  onSheetCountChange?: (count: number) => void;
};

export function DeliveryTicketPdfCanvasPreview({
  ticketId,
  activeCopy,
  activeSheet,
  zoom,
  onSheetCountChange,
}: DeliveryTicketPdfCanvasPreviewProps) {
  return (
    <PdfPageCanvas
      url={`/api/delivery-tickets/${ticketId}/preview?copy=${activeCopy}`}
      activeSheet={activeSheet}
      zoom={zoom}
      onSheetCountChange={onSheetCountChange}
      loadErrorText="Could not load delivery ticket PDF."
    />
  );
}

export function getDeliveryTicketPreviewPrintUrl(ticketId: string): string {
  return `/api/delivery-tickets/${ticketId}/preview`;
}
