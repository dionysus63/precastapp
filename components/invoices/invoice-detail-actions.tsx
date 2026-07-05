"use client";

import Link from "next/link";
import { useTransition } from "react";
import { finalizeInvoices, markInvoicePaid, voidInvoice } from "@/app/invoices/actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { printPdfUrl } from "@/lib/print-pdf-url";

type InvoiceDetailActionsProps = {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  canManage: boolean;
};

export function InvoiceDetailActions({
  invoiceId,
  invoiceNumber,
  status,
  canManage,
}: InvoiceDetailActionsProps) {
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  if (!canManage && status !== "DRAFT" && status !== "SENT" && status !== "PAID") {
    return (
      <button
        type="button"
        onClick={() => printPdfUrl(`/api/invoices/${invoiceId}/pdf`)}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
      >
        Print
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => printPdfUrl(`/api/invoices/${invoiceId}/pdf`)}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
      >
        Print
      </button>
      {canManage && status === "DRAFT" ? (
        <>
          <Link
            href={`/invoices/${invoiceId}/edit`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit draft
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              if (
                !(await confirm({
                  title: "Finalize invoice?",
                  message: `Finalize invoice ${invoiceNumber} and move it to Final Invoices?`,
                  confirmLabel: "Finalize",
                }))
              ) {
                return;
              }
              startTransition(async () => {
                await finalizeInvoices([invoiceId]);
              });
            }}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            Finalize
          </button>
        </>
      ) : null}
      {canManage && status === "SENT" ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await markInvoicePaid(invoiceId);
              });
            }}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            Mark paid
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              if (
                !(await confirm({
                  title: "Void invoice?",
                  message: `Void invoice ${invoiceNumber}?`,
                  confirmLabel: "Void invoice",
                  variant: "danger",
                }))
              ) {
                return;
              }
              startTransition(async () => {
                await voidInvoice(invoiceId);
              });
            }}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            Void
          </button>
        </>
      ) : null}
    </div>
  );
}
