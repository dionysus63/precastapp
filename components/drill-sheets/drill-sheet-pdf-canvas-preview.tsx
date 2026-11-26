"use client";

import { useCallback } from "react";
import { PdfPageCanvas } from "@/components/common/pdf-page-canvas";
import type { PdfZoom } from "@/lib/preview-zoom";

export type DrillSheetPdfPreviewInfo = {
  source: "template" | "generated";
  computedVariant: string;
  templateVariant: string | null;
  templateName: string | null;
};

type DrillSheetPdfCanvasPreviewProps = {
  drillSheetId: string;
  activeSheet: number;
  /** How far the paper is zoomed in; 1 is fitted. */
  zoom?: PdfZoom;
  onSheetCountChange?: (count: number) => void;
  onPreviewInfoChange?: (info: DrillSheetPdfPreviewInfo) => void;
};

export function DrillSheetPdfCanvasPreview({
  drillSheetId,
  activeSheet,
  zoom,
  onSheetCountChange,
  onPreviewInfoChange,
}: DrillSheetPdfCanvasPreviewProps) {
  // The route says in its headers which drawing the sheet was printed on.
  const handleResponse = useCallback(
    (response: Response) => {
      const templateName = response.headers.get("X-Drill-Sheet-Template-Name");
      onPreviewInfoChange?.({
        source:
          response.headers.get("X-Drill-Sheet-Pdf-Source") === "template"
            ? "template"
            : "generated",
        computedVariant:
          response.headers.get("X-Drill-Sheet-Computed-Variant") ?? "unknown",
        templateVariant: response.headers.get("X-Drill-Sheet-Template-Variant"),
        // Percent-encoded by the route (header values must be Latin-1).
        templateName: templateName ? decodeURIComponent(templateName) : null,
      });
    },
    [onPreviewInfoChange],
  );

  return (
    <PdfPageCanvas
      url={getDrillSheetPreviewPrintUrl(drillSheetId)}
      activeSheet={activeSheet}
      zoom={zoom}
      onSheetCountChange={onSheetCountChange}
      onResponse={handleResponse}
      loadErrorText="Could not load drill sheet PDF."
    />
  );
}

export function getDrillSheetPreviewPrintUrl(drillSheetId: string): string {
  return `/api/drill-sheets/${drillSheetId}/preview`;
}
