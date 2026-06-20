"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { generateQuotePdf } from "@/app/quotes/pdf-actions";
import type { CompanyProfile } from "@/lib/app-settings";
import type { QuoteDetailView } from "@/components/quotes/quote-utils";

type QuotePreviewContentProps = {
  quote: QuoteDetailView;
  quoteId: string;
  company: CompanyProfile;
  logoUrl?: string | null;
};

function PreviewField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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

function NotesBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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

export function QuotePreviewContent({
  quote,
  quoteId,
  company,
  logoUrl = null,
}: QuotePreviewContentProps) {
  const [isPending, startTransition] = useTransition();
  const [pdfResult, setPdfResult] = useState<
    { type: "success"; filePath: string } | { type: "error"; message: string } | null
  >(null);

  function handleGeneratePdf() {
    setPdfResult(null);
    startTransition(async () => {
      const result = await generateQuotePdf(quoteId);
      if (result.success) {
        setPdfResult({ type: "success", filePath: result.filePath });
        return;
      }

      setPdfResult({ type: "error", message: result.error });
    });
  }

  const hasNotes =
    quote.customerNotes !== "—" ||
    quote.leadTime !== "—" ||
    quote.deliveryNotes !== "—" ||
    quote.terms !== "—";

  return (
    <>
      <div className="print:hidden border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href={`/quotes/${quote.id}`}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            ← Back to Quote
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
              <div className="flex items-start gap-4">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={`${company.name} logo`}
                    className="max-h-14 max-w-[180px] object-contain"
                  />
                ) : null}
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                    {company.name}
                  </h1>
                  <p className="mt-1 text-sm text-neutral-600">{company.address}</p>
                  <p className="text-sm text-neutral-600">
                    {company.phone} · {company.email}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tracking-wide text-neutral-900">
                  QUOTE
                </p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-end gap-3">
                    <dt className="text-neutral-500">Quote #</dt>
                    <dd className="font-semibold text-neutral-900">
                      {quote.quoteNumber}
                    </dd>
                  </div>
                  <div className="flex justify-end gap-3">
                    <dt className="text-neutral-500">Date</dt>
                    <dd className="text-neutral-900">{quote.quoteDate}</dd>
                  </div>
                  <div className="flex justify-end gap-3">
                    <dt className="text-neutral-500">Expires</dt>
                    <dd className="text-neutral-900">{quote.expirationDate}</dd>
                  </div>
                  <div className="flex justify-end gap-3">
                    <dt className="text-neutral-500">Revision</dt>
                    <dd className="text-neutral-900">{quote.revision}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </header>

          <section className="mt-6 border-b border-neutral-200 pb-6">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Customer &amp; Project
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <PreviewField label="Customer Name" value={quote.customer} />
              <PreviewField label="Contact Name" value={quote.contactName} />
              <PreviewField label="Contact Email" value={quote.contactEmail} />
              <PreviewField label="Contact Phone" value={quote.contactPhone} />
              <PreviewField label="Project Name" value={quote.projectName} />
              <PreviewField label="Project Address" value={quote.projectAddress} />
              <PreviewField label="Job Number" value={quote.jobNumber} />
              <PreviewField label="Customer PO" value={quote.customerPo} />
            </dl>
          </section>

          <section className="mt-6">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-neutral-800">
                  <th className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                    Item
                  </th>
                  <th className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                    Description
                  </th>
                  <th className="py-2 pr-3 text-right text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                    Qty
                  </th>
                  <th className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                    Unit
                  </th>
                  <th className="py-2 pr-3 text-right text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                    Unit Price
                  </th>
                  <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-neutral-500"
                    >
                      No line items on this quote.
                    </td>
                  </tr>
                ) : (
                  quote.lineItems.map((line) => (
                    <tr
                      key={line.id}
                      className="border-b border-neutral-200 align-top"
                    >
                      <td className="py-2.5 pr-3 font-medium text-neutral-900">
                        {line.item}
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-700">
                        {line.description}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-900">
                        {line.qty}
                      </td>
                      <td className="py-2.5 pr-3 text-neutral-700">{line.unit}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-900">
                        {line.unitPrice}
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-medium text-neutral-900">
                        {line.total}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="mt-6 flex justify-end break-inside-avoid">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-600">Subtotal</dt>
                <dd className="tabular-nums text-neutral-900">
                  {quote.summary.subtotal}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-600">Discount</dt>
                <dd className="tabular-nums text-neutral-900">
                  {quote.summary.discount}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-600">Delivery</dt>
                <dd className="tabular-nums text-neutral-900">
                  {quote.summary.delivery}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-600">Taxable Amount</dt>
                <dd className="tabular-nums text-neutral-900">
                  {quote.summary.taxableAmount}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-600">Sales Tax</dt>
                <dd className="tabular-nums text-neutral-900">
                  {quote.summary.salesTax}
                </dd>
              </div>
              <div className="mt-2 flex justify-between gap-4 border-t border-neutral-800 pt-2">
                <dt className="font-bold text-neutral-900">Total</dt>
                <dd className="text-lg font-bold tabular-nums text-neutral-900">
                  {quote.summary.total}
                </dd>
              </div>
            </dl>
          </section>

          {hasNotes ? (
            <section className="mt-8 space-y-4 border-t border-neutral-200 pt-6 break-inside-avoid">
              <NotesBlock label="Notes" value={quote.customerNotes} />
              <NotesBlock label="Lead Time" value={quote.leadTime} />
              <NotesBlock label="Delivery Notes" value={quote.deliveryNotes} />
              <NotesBlock
                label="Terms & Conditions"
                value={quote.terms}
              />
            </section>
          ) : null}

          <footer className="mt-10 border-t border-neutral-200 pt-6 break-inside-avoid">
            <p className="text-sm text-neutral-700">
              Thank you for the opportunity to quote your project.
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              This quote is valid until the expiration date shown above.
            </p>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <div>
                <div className="border-b border-neutral-400 pb-1" />
                <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">
                  Authorized Signature
                </p>
              </div>
              <div>
                <div className="border-b border-neutral-400 pb-1" />
                <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">
                  Date Accepted
                </p>
              </div>
            </div>
          </footer>
        </article>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in;
          }

          body {
            background: white !important;
          }
        }
      `}</style>
    </>
  );
}
