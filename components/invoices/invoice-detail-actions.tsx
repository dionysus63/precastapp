"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  deleteDraftInvoice,
  finalizeInvoices,
  markInvoicePaid,
  reopenVoidedInvoice,
  voidInvoice,
} from "@/app/invoices/actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { printPdfUrl } from "@/lib/print-pdf-url";
import {
  navigateAfterAction,
  reloadAfterAction,
} from "@/lib/reload-after-action";

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

  /** Run a status action, then reload so the page shows the new status. */
  function runAndReload(
    action: () => Promise<{ error?: string }>,
    successText: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        window.alert(result.error);
        return;
      }
      reloadAfterAction({ type: "success", text: successText });
    });
  }

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
              runAndReload(
                () => finalizeInvoices([invoiceId]),
                `Invoice ${invoiceNumber} finalized.`,
              );
            }}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            Finalize
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              if (
                !(await confirm({
                  title: "Delete draft?",
                  message: `Delete draft invoice ${invoiceNumber}? The delivery ticket can be converted again afterwards.`,
                  confirmLabel: "Delete draft",
                  variant: "danger",
                }))
              ) {
                return;
              }
              startTransition(async () => {
                const result = await deleteDraftInvoice(invoiceId);
                if (result.error) {
                  window.alert(result.error);
                  return;
                }
                navigateAfterAction("/invoices", {
                  type: "success",
                  text: `Draft ${invoiceNumber} deleted.`,
                });
              });
            }}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            Delete draft
          </button>
        </>
      ) : null}
      {canManage && status === "SENT" ? (
        <>
          <Link
            href={`/invoices/${invoiceId}/edit`}
            onClick={async (event) => {
              event.preventDefault();
              if (
                await confirm({
                  title: "Edit final invoice?",
                  message: `Invoice ${invoiceNumber} is final. Changes will alter what the customer is billed — are you sure?`,
                  confirmLabel: "Edit invoice",
                })
              ) {
                navigateAfterAction(`/invoices/${invoiceId}/edit`);
              }
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit invoice
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              runAndReload(
                () => markInvoicePaid(invoiceId),
                `Invoice ${invoiceNumber} marked paid.`,
              )
            }
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
                  message: `Void invoice ${invoiceNumber}? To correct a price or quantity, use Edit invoice instead. A voided invoice can be reopened as a draft later.`,
                  confirmLabel: "Void invoice",
                  variant: "danger",
                }))
              ) {
                return;
              }
              runAndReload(
                () => voidInvoice(invoiceId),
                `Invoice ${invoiceNumber} voided.`,
              );
            }}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            Void
          </button>
        </>
      ) : null}
      {canManage && status === "VOID" ? (
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            if (
              !(await confirm({
                title: "Reopen invoice?",
                message: `Reopen voided invoice ${invoiceNumber} as a draft? It keeps its number and delivery ticket; correct it and finalize again.`,
                confirmLabel: "Reopen as draft",
              }))
            ) {
              return;
            }
            runAndReload(
              () => reopenVoidedInvoice(invoiceId),
              `Invoice ${invoiceNumber} reopened as a draft.`,
            );
          }}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Reopen as draft
        </button>
      ) : null}
    </div>
  );
}
