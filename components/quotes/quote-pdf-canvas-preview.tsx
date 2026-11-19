"use client";

import { PdfPageCanvas } from "@/components/common/pdf-page-canvas";
import type { PdfZoom } from "@/lib/preview-zoom";

type QuotePdfCanvasPreviewProps = {
  quoteId: string;
  activeSheet: number;
  /** How far the paper is zoomed in; 1 is fitted. */
  zoom?: PdfZoom;
  onSheetCountChange?: (count: number) => void;
};

export function QuotePdfCanvasPreview({
  quoteId,
  activeSheet,
  zoom,
  onSheetCountChange,
}: QuotePdfCanvasPreviewProps) {
  return (
    <PdfPageCanvas
      url={getQuotePreviewPrintUrl(quoteId)}
      activeSheet={activeSheet}
      zoom={zoom}
      onSheetCountChange={onSheetCountChange}
      loadErrorText="Could not load quote PDF."
    />
  );
}

export function getQuotePreviewPrintUrl(quoteId: string): string {
  return `/api/quotes/${quoteId}/preview`;
}
