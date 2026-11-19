"use client";

import type { InvoiceListRow } from "@/app/invoices/actions";
import { PdfDragChip } from "@/components/common/pdf-drag-chip";
import {
  KeepZoomButton,
  PdfZoomButtons,
  type KeptPreviewZoom,
} from "@/components/common/pdf-zoom-buttons";
import {
  InvoicePaper,
  PaperNote,
  SignedTicketPaper,
} from "@/components/invoices/invoice-paper";
import { printPdfUrl } from "@/lib/print-pdf-url";
import { selectedFillClassName } from "@/lib/selected-styles";

export type InvoicePreviewSide = "invoice" | "signed";

const paneButtonClassName =
  "rounded-lg btn-plain px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50";

function signedTicketViewUrl(fileId: string): string {
  return `/api/signed-tickets/${fileId}/download`;
}

/**
 * The paper beside the Invoices list: the invoice of the row that was
 * clicked, as it prints, or the signed copy of its delivery ticket. A ticket
 * with no signed copy scanned in shows NOT AVAILABLE. The zoom buttons make
 * the paper larger than its pane (it then scrolls both ways), and "Keep zoom"
 * makes the zoom showing the one this screen opens at for the user's account.
 */
export function InvoiceListPreview({
  row,
  side,
  onSideChange,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  zoom: keptZoom,
}: {
  row: InvoiceListRow | null;
  side: InvoicePreviewSide;
  onSideChange: (side: InvoicePreviewSide) => void;
  /** Step to the row above / below in the list. */
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  /** The pane's zoom, and the one the user's account keeps for this screen. */
  zoom: KeptPreviewZoom;
}) {
  const zoom = keptZoom.zoom;
  const signed = row?.signedTicket ?? null;
  const showSigned = side === "signed";
  const invoicePdfUrl = row ? `/api/invoices/${row.id}/pdf` : null;
  const shownPdfUrl = !row
    ? null
    : showSigned
      ? signed
        ? `${signedTicketViewUrl(signed.fileId)}?view=1`
        : null
      : invoicePdfUrl;

  return (
    <section
      aria-label="Invoice preview"
      // No taller than the window under the app header: the paper scrolls
      // inside the pane, and its buttons stay in view.
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm lg:max-h-[calc(100vh_-_82px_-_0.75rem)]"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 px-3 py-2">
        <p className="text-sm font-semibold text-slate-900">
          {row ? row.invoiceNumber : "No invoice selected"}
        </p>
        {row ? (
          <p className="text-xs text-slate-500">
            {[row.ticketNumber, row.customerName].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Show the invoice or its signed ticket"
            className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold"
          >
            {(
              [
                ["invoice", "Invoice"],
                ["signed", "Signed Ticket"],
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
          <div className="inline-flex gap-1">
            <button
              type="button"
              onClick={onPrevious}
              disabled={!hasPrevious}
              aria-label="Previous invoice"
              title="The row above"
              className={paneButtonClassName}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              aria-label="Next invoice"
              title="The row below"
              className={paneButtonClassName}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {shownPdfUrl ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-1.5">
          <a
            href={shownPdfUrl}
            target="_blank"
            rel="noreferrer"
            className={paneButtonClassName}
          >
            Open PDF
          </a>
          <button
            type="button"
            onClick={() => printPdfUrl(shownPdfUrl)}
            className={paneButtonClassName}
          >
            Print
          </button>
          {row && showSigned && signed ? (
            <PdfDragChip
              href={signedTicketViewUrl(signed.fileId)}
              fileName={signed.fileName}
              title={`Signed copy of ${row.ticketNumber}: drag it into an email or a folder, or click to save it`}
              label="Signed PDF"
              className={paneButtonClassName}
            />
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <PdfZoomButtons
              zoomIndex={keptZoom.zoomIndex}
              onZoomIndex={keptZoom.setZoomIndex}
              buttonClassName={paneButtonClassName}
            />
            <KeepZoomButton kept={keptZoom} className={paneButtonClassName} />
          </div>
        </div>
      ) : null}

      <div
        className="min-h-0 overflow-auto bg-slate-100 p-3"
        data-invoice-preview-scroll
      >
        {!row ? (
          <PaperNote
            text="Click an invoice in the list to see it here."
            size="fill"
          />
        ) : showSigned ? (
          signed ? (
            <SignedTicketPaper
              key={signed.fileId}
              fileId={signed.fileId}
              pageCount={signed.pageCount}
              ticketNumber={row.ticketNumber}
              size="fill"
              zoom={zoom}
            />
          ) : (
            <PaperNote
              heading="NOT AVAILABLE"
              text={`No signed copy of ticket ${row.ticketNumber} has been scanned in.`}
              size="fill"
            />
          )
        ) : (
          <InvoicePaper
            // A payment, an edit or a void changes what prints.
            key={`${row.id}:${row.status}:${row.total}`}
            invoiceId={row.id}
            size="fill"
            zoom={zoom}
          />
        )}
      </div>
    </section>
  );
}
