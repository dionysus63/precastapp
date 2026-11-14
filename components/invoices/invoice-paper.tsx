"use client";

import { useEffect, useState } from "react";

/**
 * The sheets of paper drawn in the preview panes of the Invoices screens
 * (Scan In and the Invoices list): an invoice, a signed ticket, or a note
 * where there is nothing to show.
 */

/**
 * The paper is never taller than the window, so the foot of the page stays
 * in view while the pane sticks beside the grid. Letter paper is 8.5 x 11:
 * width = height x 0.7727.
 */
export const paperStyle = {
  maxWidth: "min(42rem, calc((100vh - 13rem) * 0.7727))",
} as const;

const stepButtonClassName =
  "rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

/** A blank sheet with a line of text; `heading` is the large line above it. */
export function PaperNote({
  text,
  heading,
}: {
  text: string;
  heading?: string;
}) {
  return (
    <div
      style={paperStyle}
      className="mx-auto grid aspect-[612/792] w-full place-items-center border border-slate-300 bg-white px-10 text-center text-sm text-slate-500 shadow"
    >
      <div>
        {heading ? (
          <p className="mb-2 text-xl font-semibold tracking-wide text-slate-400">
            {heading}
          </p>
        ) : null}
        <p>{text}</p>
      </div>
    </div>
  );
}

function PageStepper({
  label,
  page,
  pageCount,
  onPage,
}: {
  label: string;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return null;
  }
  return (
    <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-600">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
        className={stepButtonClassName}
      >
        ‹
      </button>
      <span>
        {label} {page} of {pageCount}
      </span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
        className={stepButtonClassName}
      >
        ›
      </button>
    </div>
  );
}

type InvoicePage = { url: string; pageCount: number };

/**
 * An invoice as it prints, one page at a time, drawn by the server from the
 * invoice as it is saved right now.
 */
export function InvoicePaper({ invoiceId }: { invoiceId: string }) {
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
        <img
          src={loaded.url}
          alt="Invoice page"
          data-invoice-paper="ready"
          className="block h-auto w-full"
        />
      </div>
      <PageStepper
        label="Invoice page"
        page={page}
        pageCount={loaded.pageCount}
        onPage={setPage}
      />
    </div>
  );
}

/**
 * A ticket's signed copy as Scan In filed it, one scanned page at a time.
 */
export function SignedTicketPaper({
  fileId,
  pageCount,
  ticketNumber,
}: {
  fileId: string;
  pageCount: number;
  ticketNumber: string;
}) {
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const shownPage = Math.min(Math.max(page, 1), Math.max(pageCount, 1));

  return (
    <div style={paperStyle} className="mx-auto w-full">
      <div className="relative border border-slate-300 bg-white shadow">
        {state === "failed" ? (
          <div className="grid aspect-[612/792] place-items-center px-10 text-center text-sm text-slate-500">
            The signed ticket&apos;s picture could not be loaded.
          </div>
        ) : (
          /* A plain img: the picture is drawn by the server per page and is
             not something next/image should resize or cache. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={shownPage}
            src={`/api/signed-tickets/${fileId}/pages/${shownPage}/image`}
            alt={`Signed ticket ${ticketNumber}, page ${shownPage}`}
            data-signed-ticket-paper={state}
            onLoad={() => setState("ready")}
            onError={() => setState("failed")}
            className={`block h-auto w-full ${state === "loading" ? "min-h-[24rem] opacity-0" : ""}`}
          />
        )}
        {state === "loading" ? (
          <p className="absolute inset-0 grid place-items-center text-sm text-slate-400">
            Loading the signed ticket…
          </p>
        ) : null}
      </div>
      <PageStepper
        label="Signed page"
        page={shownPage}
        pageCount={pageCount}
        onPage={(next) => {
          setState("loading");
          setPage(next);
        }}
      />
    </div>
  );
}
