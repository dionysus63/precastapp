"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { generateDeliveryTicketPdf } from "@/app/delivery-tickets/pdf-actions";
import type { CompanyProfile } from "@/lib/app-settings";
import type { DeliveryTicketDetailView } from "@/components/delivery-tickets/delivery-ticket-utils";

type DeliveryTicketPreviewContentProps = {
  ticket: DeliveryTicketDetailView;
  ticketId: string;
  company: CompanyProfile;
  logoUrl?: string | null;
};

function PreviewField({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") {
    return null;
  }

  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

function NotesBlock({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") {
    return null;
  }

  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </h3>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
        {value}
      </p>
    </div>
  );
}

export function DeliveryTicketPreviewContent({
  ticket,
  ticketId,
  company,
  logoUrl = null,
}: DeliveryTicketPreviewContentProps) {
  const [isPending, startTransition] = useTransition();
  const [pdfResult, setPdfResult] = useState<
    { type: "success"; filePath: string } | { type: "error"; message: string } | null
  >(null);

  function handleGeneratePdf() {
    setPdfResult(null);
    startTransition(async () => {
      const result = await generateDeliveryTicketPdf(ticketId);
      if (result.success) {
        setPdfResult({ type: "success", filePath: result.filePath });
        return;
      }
      setPdfResult({ type: "error", message: result.error });
    });
  }

  return (
    <>
      <div className="print:hidden border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href={`/delivery-tickets/${ticketId}`}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            ← Back to Ticket
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded border border-neutral-300 bg-white px-4 py-1.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Print
            </button>
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={isPending}
              className="rounded border border-neutral-800 bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Generating..." : "Generate PDF"}
            </button>
          </div>
        </div>
        {pdfResult?.type === "success" ? (
          <div className="mx-auto max-w-[8.5in] border-t border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold">PDF generated successfully.</p>
            <p className="mt-1 break-all text-emerald-800">
              Saved to:{" "}
              <span className="font-mono text-xs">{pdfResult.filePath}</span>
            </p>
          </div>
        ) : null}
        {pdfResult?.type === "error" ? (
          <div className="mx-auto max-w-[8.5in] border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {pdfResult.message}
          </div>
        ) : null}
      </div>

      <div className="min-h-screen bg-neutral-200 py-8 print:bg-white print:py-0">
        <article
          className="mx-auto w-full max-w-[8.5in] bg-white px-10 py-10 shadow-lg print:max-w-none print:px-0 print:py-0 print:shadow-none"
          style={{ minHeight: "11in" }}
        >
          <header className="border-b border-neutral-300 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">
                  Delivery Ticket {ticket.ticketNumber}
                </h1>
                <p className="mt-1 text-sm text-neutral-700">
                  {ticket.projectName} — {ticket.customer}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3 text-right text-sm text-neutral-700">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={`${company.name} logo`}
                    className="max-h-14 max-w-[180px] object-contain"
                  />
                ) : null}
                <div>
                  <p className="font-semibold text-neutral-900">{company.name}</p>
                  <p>{company.address}</p>
                  <p>{company.phone}</p>
                </div>
              </div>
            </div>
          </header>

          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <PreviewField label="Status" value={ticket.statusLabel} />
            <PreviewField
              label="Delivery Date"
              value={
                ticket.deliveryTime && ticket.deliveryTime !== "—"
                  ? `${ticket.deliveryDate} ${ticket.deliveryTime}`
                  : ticket.deliveryDate
              }
            />
            <PreviewField label="Job Number" value={ticket.jobNumber} />
            <PreviewField label="Delivery Address" value={ticket.deliveryAddress} />
            <PreviewField
              label="Truck / Trailer"
              value={`${ticket.truck} / ${ticket.trailer}`}
            />
            <PreviewField label="Driver" value={ticket.driver} />
            <PreviewField
              label="Site Contact"
              value={`${ticket.siteContactName} · ${ticket.siteContactPhone}`}
            />
            <PreviewField label="Total Weight" value={ticket.totalWeight} />
          </section>

          <section className="mt-8">
            <h2 className="border-b border-neutral-300 pb-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">
              Delivery Items
            </h2>
            <table className="mt-4 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3">Unit</th>
                  <th className="py-2 text-right">Weight</th>
                </tr>
              </thead>
              <tbody>
                {ticket.lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-neutral-500">
                      No line items on this ticket.
                    </td>
                  </tr>
                ) : (
                  ticket.lineItems.map((line) => (
                    <tr key={line.id} className="border-b border-neutral-200">
                      <td className="py-2 pr-3 text-right">{line.lineNumber}</td>
                      <td className="py-2 pr-3">{line.type.replace(/_/g, " ")}</td>
                      <td className="py-2 pr-3 font-medium text-neutral-900">{line.item}</td>
                      <td className="py-2 pr-3 text-neutral-700">{line.description}</td>
                      <td className="py-2 pr-3 text-right">{line.qty}</td>
                      <td className="py-2 pr-3">{line.unit}</td>
                      <td className="py-2 text-right">{line.totalWeight}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="mt-8 space-y-4">
            <NotesBlock label="Driver Notes" value={ticket.driverNotes} />
            <NotesBlock label="Loading Notes" value={ticket.loadingNotes} />
            <NotesBlock label="Site Instructions" value={ticket.siteInstructions} />
          </section>
        </article>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }
        }
      `}</style>
    </>
  );
}
