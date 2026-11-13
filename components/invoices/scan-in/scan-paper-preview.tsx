"use client";

import { useEffect, useState } from "react";
import {
  barButtonClassName,
  rowResult,
  scanCardClassName,
} from "@/components/invoices/scan-in/scan-ui";
import type { ScanInRow } from "@/lib/ticket-scan/view-types";

type Side = "ticket" | "invoice";

/**
 * The paper is never taller than the window, so the foot of the page (where
 * the code is) stays in view while the pane sticks beside the grid. Letter
 * paper is 8.5 x 11: width = height x 0.7727.
 */
const paperStyle = {
  maxWidth: "min(42rem, calc((100vh - 13rem) * 0.7727))",
} as const;

/**
 * The paper beside the grid: the scanned page of the selected row, turned
 * upright, with a box around the code that was read. For a ticket that has
 * an invoice, the same pane can show the invoice instead.
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
                      ? "bg-slate-900 px-2.5 py-1 text-white"
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

      {row && actions && !showInvoice ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-1.5">
          {actions}
        </div>
      ) : null}

      <div className="bg-slate-100 p-3">
        {!row ? (
          <PaperNote text="Click a row to see its page here." />
        ) : showInvoice ? (
          <InvoicePaper key={row.invoice!.id} invoiceId={row.invoice!.id} />
        ) : row.imageUrl ? (
          <TicketPaper key={row.imageUrl} row={row} />
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

function PaperNote({ text }: { text: string }) {
  return (
    <div
      style={paperStyle}
      className="mx-auto grid aspect-[612/792] w-full place-items-center border border-slate-300 bg-white px-10 text-center text-sm text-slate-500 shadow"
    >
      {text}
    </div>
  );
}

function TicketPaper({ row }: { row: ScanInRow }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const box = row.codeBox;
  // Keep the label inside the page when the code sits near the left edge.
  const labelOnLeft = box ? box.left + box.width < 0.45 : false;

  return (
    <div
      style={paperStyle}
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
          src={row.imageUrl!}
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

type InvoicePage = { url: string; pageCount: number };

function InvoicePaper({ invoiceId }: { invoiceId: string }) {
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<InvoicePage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const response = await fetch(
          `/api/invoices/${invoiceId}/pages/${page}/image`,
        );
        if (!response.ok) {
          throw new Error((await response.text()).slice(0, 200));
        }
        const blob = await response.blob();
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setError(null);
        setLoaded({
          url: objectUrl,
          pageCount: Number(response.headers.get("X-Page-Count")) || 1,
        });
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error && caught.message
              ? caught.message
              : "The invoice could not be drawn.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [invoiceId, page]);

  if (error) {
    return <PaperNote text={error} />;
  }
  if (!loaded) {
    return <PaperNote text="Drawing the invoice…" />;
  }
  return (
    <div style={paperStyle} className="mx-auto w-full">
      <div className="border border-slate-300 bg-white shadow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={loaded.url} alt="Invoice page" className="block h-auto w-full" />
      </div>
      {loaded.pageCount > 1 ? (
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-600">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            className={`${barButtonClassName} px-2 py-0.5`}
          >
            ‹
          </button>
          <span>
            Invoice page {page} of {loaded.pageCount}
          </span>
          <button
            type="button"
            disabled={page >= loaded.pageCount}
            onClick={() => setPage((current) => current + 1)}
            className={`${barButtonClassName} px-2 py-0.5`}
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
