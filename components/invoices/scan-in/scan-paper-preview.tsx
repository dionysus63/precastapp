"use client";

import { useState } from "react";
import {
  KeepZoomButton,
  PdfZoomButtons,
  usePreviewZoom,
} from "@/components/common/pdf-zoom-buttons";
import {
  InvoicePaper,
  PaperNote,
  paperSizeStyle,
  pictureUrlAtZoom,
} from "@/components/invoices/invoice-paper";
import {
  barButtonClassName,
  rowResult,
  scanCardClassName,
} from "@/components/invoices/scan-in/scan-ui";
import type { PdfZoom } from "@/lib/preview-zoom";
import type { ScanInRow } from "@/lib/ticket-scan/view-types";
import { selectedFillClassName } from "@/lib/selected-styles";

type Side = "ticket" | "invoice";

/**
 * The paper beside the grid: the scanned page of the selected row, turned
 * upright, with a box around the code that was read. For a ticket that has
 * an invoice, the same pane can show the invoice instead. The zoom buttons
 * make the paper larger than its pane (it then scrolls both ways), and "Keep
 * zoom" makes the zoom showing the one Scan In opens at for the user's
 * account.
 */
export function ScanPaperPreview({
  row,
  side,
  onSideChange,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  actions,
}: {
  row: ScanInRow | null;
  side: Side;
  onSideChange: (side: Side) => void;
  /** Step to the row above / below in the grid. */
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  /** Buttons for the selected page (Turn, Skip Page…). */
  actions?: React.ReactNode;
}) {
  const showInvoice = side === "invoice" && row?.invoice != null;
  const zoomState = usePreviewZoom("scan-in");
  const zoom = zoomState.zoom;
  const hasPaper = row != null && (showInvoice || row.imageUrl != null);

  return (
    <section className={`${scanCardClassName} flex flex-col`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 px-3 py-2">
        <p className="text-sm font-semibold text-slate-900">
          {row ? `Page ${row.pgLabel}` : "No page selected"}
        </p>
        {row ? (
          <p className="text-xs text-slate-500">
            {[
              row.ticketNumber,
              showInvoice ? `Invoice ${row.invoice!.invoiceNumber}` : rowResult(row).label,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {row?.invoice ? (
            <div
              role="group"
              aria-label="Show the signed ticket or its invoice"
              className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold"
            >
              {(
                [
                  ["ticket", "Signed Ticket"],
                  ["invoice", "Invoice"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={side === value}
                  onClick={() => onSideChange(value)}
                  className={
                    side === value
                      ? `${selectedFillClassName} px-2.5 py-1`
                      : "bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="inline-flex gap-1">
            <button
              type="button"
              onClick={onPrevious}
              disabled={!hasPrevious}
              aria-label="Previous page"
              title="The row above"
              className={`${barButtonClassName} px-2.5 py-1`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              aria-label="Next page"
              title="The row below"
              className={`${barButtonClassName} px-2.5 py-1`}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {row && ((actions && !showInvoice) || hasPaper) ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-1.5">
          {showInvoice ? null : actions}
          {hasPaper ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <PdfZoomButtons
                zoomIndex={zoomState.zoomIndex}
                onZoomIndex={zoomState.setZoomIndex}
                buttonClassName={barButtonClassName}
              />
              <KeepZoomButton zoom={zoomState} className={barButtonClassName} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={
          zoom === 1
            ? "bg-slate-100 p-3"
            : // Zoomed, the paper scrolls in a box no taller than the
              // fitted page and its padding can be: the window's room
              // (8.3125rem less 2 x 0.75rem), or the page at its widest
              // (42rem wide, so 54.375rem tall, plus the padding).
              "max-h-[min(calc(100vh_-_var(--app-header-height)_-_6.8125rem),55.875rem)] overflow-auto bg-slate-100 p-3"
        }
        data-scan-preview-scroll
      >
        {!row ? (
          <PaperNote text="Click a row to see its page here." />
        ) : showInvoice ? (
          <InvoicePaper
            key={row.invoice!.id}
            invoiceId={row.invoice!.id}
            zoom={zoom}
          />
        ) : row.imageUrl ? (
          <TicketPaper key={row.imageUrl} row={row} zoom={zoom} />
        ) : (
          <PaperNote
            text={
              row.kind === "reading"
                ? "This page has not been read yet."
                : "This page was left out when the scan was filed, so its picture was not kept."
            }
          />
        )}
      </div>
    </section>
  );
}

function TicketPaper({ row, zoom }: { row: ScanInRow; zoom: PdfZoom }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const box = row.codeBox;
  // Keep the label inside the page when the code sits near the left edge.
  const labelOnLeft = box ? box.left + box.width < 0.45 : false;

  return (
    <div
      style={paperSizeStyle("fit", zoom)}
      className="relative mx-auto w-full border border-slate-300 bg-white shadow"
    >
      {state === "failed" ? (
        <div className="grid aspect-[612/792] place-items-center px-10 text-center text-sm text-slate-500">
          This page&apos;s picture could not be loaded.
        </div>
      ) : (
        /* A plain img: the picture is drawn by the server per page and is
           not something next/image should resize or cache. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pictureUrlAtZoom(row.imageUrl!, zoom)}
          alt={`Scanned page ${row.pgLabel}${row.ticketNumber ? `, ticket ${row.ticketNumber}` : ""}`}
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
          className={`block h-auto w-full ${state === "loading" ? "min-h-[24rem] opacity-0" : ""}`}
        />
      )}
      {state === "loading" ? (
        <p className="absolute inset-0 grid place-items-center text-sm text-slate-400">
          Loading the page…
        </p>
      ) : null}
      {state === "ready" && box ? (
        <div
          className="pointer-events-none absolute rounded-sm border-2 border-emerald-600"
          style={{
            left: `${box.left * 100}%`,
            top: `${box.top * 100}%`,
            width: `${box.width * 100}%`,
            height: `${box.height * 100}%`,
          }}
        >
          <span
            className={`absolute bottom-full mb-1 whitespace-nowrap rounded-sm bg-emerald-600 px-1.5 py-0.5 text-2xs font-semibold text-white ${
              labelOnLeft ? "-left-0.5" : "-right-0.5"
            }`}
          >
            Code read{row.ticketNumber ? `: ${row.ticketNumber}` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
