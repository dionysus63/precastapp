"use client";

import { PdfDragChip } from "@/components/common/pdf-drag-chip";

/**
 * Drag-out handle for the quote PDF (see PdfDragChip). If Outlook won't take
 * the browser fallback drag, drop on the desktop first, or use Send Quote.
 */
export function QuotePdfDragChip({
  quoteId,
  fileName,
  className,
}: {
  quoteId: string;
  fileName: string;
  className?: string;
}) {
  return (
    <PdfDragChip
      href={`/api/quotes/${quoteId}/preview?download=1`}
      fileName={fileName}
      title="Drag onto an email, folder, or your desktop to copy the quote PDF — or click to download."
      className={className}
    />
  );
}
