"use client";

import { useEffect, useRef, useState } from "react";
// Registers the window.precastOpsDesktop type declaration.
import "@/lib/open-on-client";

/**
 * Drag-out handle for a PDF. Drag it onto the desktop, a folder, or an email
 * to copy the PDF there; click to download it normally.
 *
 * Inside the desktop shell (≥ 0.1.4) the drag is a genuine OS file drag —
 * the shell pulls the PDF to a temp file and hands Windows a real file, so
 * Outlook accepts it. In a plain Chromium browser it falls back to the
 * DownloadURL drag type, which Explorer and the desktop accept (the file
 * downloads at the drop target); Outlook may not take that one — drop on the
 * desktop first.
 *
 * `href` must serve the PDF as a download (attachment).
 *
 * `preparingLabel` is for files that take a moment to build (a packet of
 * many sheets): inside the desktop shell the chip shows it while the shell
 * is still pulling the file, so it's clear when the drag is ready.
 */
export function PdfDragChip({
  href,
  fileName,
  title,
  label = "PDF",
  preparingLabel,
  className,
}: {
  href: string;
  fileName: string;
  title: string;
  label?: string;
  preparingLabel?: string;
  className?: string;
}) {
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  /** The newest warm-up; an older one finishing late must not change the label. */
  const prepareRun = useRef(0);
  useEffect(() => {
    // Leaving the page drops any warm-up still in flight.
    return () => {
      prepareRun.current += 1;
    };
  }, []);

  function absoluteUrl() {
    return new URL(href, window.location.origin).toString();
  }

  function handlePointerEnter() {
    // Warm the shell's temp copy so the native drag attaches instantly.
    const prepare = window.precastOpsDesktop?.prepareFileDrag;
    if (!prepare) {
      return;
    }
    const pending = prepare(absoluteUrl(), fileName);
    if (!preparingLabel) {
      void pending;
      return;
    }
    const run = (prepareRun.current += 1);
    // A file the shell already holds resolves at once; only a real wait
    // swaps the label.
    const showTimer = window.setTimeout(() => {
      if (prepareRun.current === run) {
        setPreparing(true);
      }
    }, 200);
    const finish = (error: string | null) => {
      window.clearTimeout(showTimer);
      if (prepareRun.current === run) {
        setPreparing(false);
        setPrepareError(error);
      }
    };
    pending.then(
      (error) => finish(error || null),
      () => finish("The file could not be prepared."),
    );
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
      title={prepareError ? `${prepareError} ${title}` : title}
      aria-busy={preparing || undefined}
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
      {preparing && preparingLabel ? preparingLabel : label}
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
