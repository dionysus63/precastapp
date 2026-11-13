"use client";

import Link from "next/link";
import { PdfDragChip } from "@/components/common/pdf-drag-chip";
import {
  ResultPill,
  ScanCardHead,
  barPrimaryButtonClassName,
  cellChipClassName,
  cellLinkClassName,
  pluralize,
  scanCardClassName,
} from "@/components/invoices/scan-in/scan-ui";
import { formatUsd } from "@/lib/format";
import { printPdfUrl } from "@/lib/print-pdf-url";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";
import type {
  ScanInFiledScan,
  ScanInFiledTicket,
} from "@/lib/ticket-scan/view-types";

function filedSentences(filed: ScanInFiledScan, jobFolderName: string): string[] {
  const { counts } = filed;
  const first = filed.tickets[0];
  const sentences: string[] = [];
  if (first) {
    sentences.push(
      `Each one is saved under its ticket number, like ${first.ticketNumber}.pdf.`,
    );
    if (counts.jobFolderCopies > 0) {
      sentences.push(
        counts.jobFolderCopies === counts.tickets
          ? `A copy named like "${first.signedFileName}" went into each job's ${jobFolderName} folder.`
          : `${counts.jobFolderCopies.toLocaleString()} of them also ${counts.jobFolderCopies === 1 ? "has" : "have"} a copy named like "${first.signedFileName}" in the job's ${jobFolderName} folder.`,
      );
    }
  }
  if (counts.markedDelivered > 0) {
    sentences.push(`${pluralize(counts.markedDelivered, "ticket")} marked delivered.`);
  }
  sentences.push(
    counts.invoices > 0
      ? `${pluralize(counts.invoices, "invoice")} ready to print.`
      : "No invoices to print.",
  );
  if (counts.leftOut > 0) {
    sentences.push(`${pluralize(counts.leftOut, "page")} left out.`);
  }
  return sentences;
}

/**
 * "Invoices from this scan": what File made, in the order of the paper
 * stack, with one button to print them all behind their summary page.
 */
export function ScanFiledInvoices({
  filed,
  jobFolderName,
  selectedTicketId,
  onPickTicket,
}: {
  filed: ScanInFiledScan;
  jobFolderName: string;
  /** The ticket whose page or invoice is in the preview. */
  selectedTicketId: string | null;
  onPickTicket: (ticket: ScanInFiledTicket) => void;
}) {
  const { counts } = filed;
  const warnings = filed.tickets.flatMap((ticket) =>
    ticket.warnings.map((warning) => `${ticket.ticketNumber}: ${warning}`),
  );

  return (
    <section
      id="scan-in-invoices"
      className={`${scanCardClassName} border-sky-300 ring-1 ring-sky-300`}
    >
      <ScanCardHead
        title="Invoices from this scan"
        hint="Made when the tickets were filed. Same order as the paper stack."
        action={
          <button
            type="button"
            disabled={!filed.printInvoicesUrl}
            onClick={() => {
              if (filed.printInvoicesUrl) {
                printPdfUrl(filed.printInvoicesUrl);
              }
            }}
            title="Prints the Invoice Summary page, then every invoice in the order of the paper stack"
            className={barPrimaryButtonClassName}
          >
            Print {pluralize(counts.invoices, "Invoice")}
          </button>
        }
      />

      <div className="space-y-2 px-4 py-3">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <span className="font-semibold">
            Filed {pluralize(counts.tickets, "signed ticket")},{" "}
            {pluralize(counts.pages, "page")}, on {filed.filedLabel}
            {filed.filedBy ? ` by ${filed.filedBy}` : ""}.
          </span>{" "}
          {filedSentences(filed, jobFolderName).join(" ")}
        </p>
        {filed.failures.length > 0 ? (
          <ul className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
            {filed.failures.map((failure) => (
              <li key={failure.ticketNumber}>
                <span className="font-semibold">
                  {failure.ticketNumber} was not filed:
                </span>{" "}
                {failure.error}
              </li>
            ))}
          </ul>
        ) : null}
        {warnings.length > 0 ? (
          <ul className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {filed.tickets.length > 0 ? (
        <div className={`${tableFlushWrapperClassName} border-t border-slate-200`}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Ticket</th>
                <th className={tableHeaderCellClassName}>Invoice</th>
                <th className={tableHeaderCellClassName}>Customer and project</th>
                <th className={tableHeaderCellClassName}>Price</th>
                <th className={tableHeaderCellClassName}>Tax</th>
                <th className={tableHeaderCellClassName}>Total</th>
                <th className={tableHeaderCellClassName}>Note</th>
                <th className={tableHeaderCellClassName}>Actions</th>
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {filed.tickets.map((ticket) => {
                const invoice = ticket.invoice;
                const selected = ticket.ticketId === selectedTicketId;
                const cell = `${tableCellClassName} ${selected ? "bg-sky-50" : ""}`;
                const stop = (event: React.SyntheticEvent) =>
                  event.stopPropagation();
                return (
                  <tr
                    key={ticket.ticketId}
                    tabIndex={0}
                    aria-selected={selected}
                    onClick={() => onPickTicket(ticket)}
                    onKeyDown={(event) => {
                      if (
                        event.target === event.currentTarget &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        onPickTicket(ticket);
                      }
                    }}
                    className="cursor-pointer align-top outline-none hover:bg-slate-50/60 focus-visible:bg-sky-50/60"
                  >
                    <td
                      className={`${cell} whitespace-nowrap font-semibold ${
                        selected ? "shadow-[inset_3px_0_0_#0284c7]" : ""
                      }`}
                    >
                      {ticket.ticketNumber}
                    </td>
                    <td className={`${cell} whitespace-nowrap`}>
                      {invoice ? (
                        <Link
                          href={`/invoices/${invoice.id}`}
                          onClick={stop}
                          className="text-slate-900 underline decoration-slate-300 hover:decoration-slate-600"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      ) : null}
                    </td>
                    <td className={`${cell} min-w-[10rem]`}>
                      {ticket.customerName}
                      {ticket.projectName ? (
                        <span className="block text-slate-500">
                          {ticket.projectName}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${cell} whitespace-nowrap tabular-nums`}>
                      {invoice ? formatUsd(invoice.price) : ""}
                    </td>
                    <td className={`${cell} whitespace-nowrap tabular-nums`}>
                      {invoice ? formatUsd(invoice.salesTax) : ""}
                    </td>
                    <td
                      className={`${cell} whitespace-nowrap font-semibold tabular-nums`}
                    >
                      {invoice ? formatUsd(invoice.total) : ""}
                    </td>
                    <td className={`${cell} min-w-[9rem]`}>
                      <InvoiceNote ticket={ticket} />
                    </td>
                    <td className={`${cell} whitespace-nowrap`}>
                      <div className="flex items-center gap-2">
                        {invoice?.canEdit ? (
                          <Link
                            href={`/invoices/${invoice.id}/edit`}
                            onClick={stop}
                            className={cellLinkClassName}
                          >
                            Edit
                          </Link>
                        ) : null}
                        {invoice && invoice.statusLabel !== "Void" ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              printPdfUrl(`/api/invoices/${invoice.id}/pdf`);
                            }}
                            title={`Print just ${invoice.invoiceNumber}`}
                            className={cellLinkClassName}
                          >
                            Print
                          </button>
                        ) : null}
                        <span onClick={stop}>
                          <PdfDragChip
                            href={ticket.signedFileUrl}
                            fileName={ticket.signedFileName}
                            title={`Signed copy of ${ticket.ticketNumber}: drag it into an email or a folder, or click to save it`}
                            label="Signed PDF"
                            className={cellChipClassName}
                          />
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        Click a row to see its invoice beside the signed ticket.
      </p>
    </section>
  );
}

function InvoiceNote({ ticket }: { ticket: ScanInFiledTicket }) {
  const invoice = ticket.invoice;
  if (!invoice) {
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ResultPill label="No invoice" tone="muted" />
        {ticket.noInvoiceNote ? (
          <span className="text-2xs text-slate-500">{ticket.noInvoiceNote}</span>
        ) : null}
      </span>
    );
  }
  const priceNeeded = invoice.priceNeededItems.length > 0;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {priceNeeded ? <ResultPill label="Price needed" tone="warn" /> : null}
      {invoice.statusLabel === "Paid" ? (
        <ResultPill label="Paid" tone="ok" />
      ) : null}
      {invoice.statusLabel === "Void" ? (
        <ResultPill label="Void" tone="muted" />
      ) : null}
      {priceNeeded ? (
        <span className="text-2xs text-slate-500">
          {invoice.priceNeededItems.join(", ")}
        </span>
      ) : invoice.note && invoice.note !== "Void" ? (
        <span className="text-2xs text-slate-500">{invoice.note}</span>
      ) : null}
      {ticket.replaced ? (
        <span className="text-2xs text-slate-500">
          Replaced an earlier signed copy
        </span>
      ) : null}
    </span>
  );
}
