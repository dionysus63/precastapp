"use client";

// Registers the window.precastOpsDesktop type declaration.
import "@/lib/open-on-client";

/**
 * Drag-out handle for the quote PDF. Drag it onto the desktop, a folder, or
 * an email to copy the PDF there; click to download it normally.
 *
 * Inside the desktop shell (≥ 0.1.4) the drag is a genuine OS file drag —
 * the shell pulls the PDF to a temp file and hands Windows a real file, so
 * Outlook accepts it. In a plain Chromium browser it falls back to the
 * DownloadURL drag type, which Explorer and the desktop accept (the file
 * downloads at the drop target); Outlook may not take that one — drop on the
 * desktop first, or use Send Quote.
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
  const href = `/api/quotes/${quoteId}/preview?download=1`;

  function absoluteUrl() {
    return new URL(href, window.location.origin).toString();
  }

  function handlePointerEnter() {
    // Warm the shell's temp copy so the native drag attaches instantly.
    void window.precastOpsDesktop?.prepareFileDrag?.(absoluteUrl(), fileName);
  }

  function handleDragStart(event: React.DragEvent<HTMLAnchorElement>) {
    const desktop = window.precastOpsDesktop;
    if (desktop?.startFileDrag) {
      event.preventDefault();
      desktop.startFileDrag(absoluteUrl(), fileName);
      return;
    }
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "DownloadURL",
      `application/pdf:${fileName}:${absoluteUrl()}`,
    );
  }

  return (
    <a
      href={href}
      draggable
      onPointerEnter={handlePointerEnter}
      onDragStart={handleDragStart}
      title="Drag onto an email, folder, or your desktop to copy the quote PDF — or click to download."
      className={`${className ?? ""} inline-flex cursor-grab items-center gap-1.5 active:cursor-grabbing`}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 text-red-600"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5z" />
        <path d="M9.5 1.5V5H13" />
      </svg>
      PDF
      <svg
        viewBox="0 0 16 16"
        className="h-3 w-3 text-slate-400"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="5.5" cy="4" r="1.1" />
        <circle cx="10.5" cy="4" r="1.1" />
        <circle cx="5.5" cy="8" r="1.1" />
        <circle cx="10.5" cy="8" r="1.1" />
        <circle cx="5.5" cy="12" r="1.1" />
        <circle cx="10.5" cy="12" r="1.1" />
      </svg>
    </a>
  );
}
