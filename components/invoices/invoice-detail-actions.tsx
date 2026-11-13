"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  deleteInvoice,
  markInvoicePaid,
  reopenVoidedInvoice,
  voidInvoice,
} from "@/app/invoices/actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { isUnpaidInvoiceStatus } from "@/lib/invoice-status";
import { printPdfUrl } from "@/lib/print-pdf-url";
import {
  navigateAfterAction,
  reloadAfterAction,
} from "@/lib/reload-after-action";

type InvoiceDetailActionsProps = {
  invoiceId: string;
  invoiceNumber: string;
  ticketNumber: string;
  status: string;
  /** A line is still waiting for a price, so the total isn't known yet. */
  needsPrice: boolean;
  canManage: boolean;
};

const plainButtonClassName =
  "rounded-lg border border-slate-200 px-3 py-1.5 text-2xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const dangerButtonClassName =
  "rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-2xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50";

export function InvoiceDetailActions({
  invoiceId,
  invoiceNumber,
  ticketNumber,
  status,
  needsPrice,
  canManage,
}: InvoiceDetailActionsProps) {
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const unpaid = isUnpaidInvoiceStatus(status);

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

  async function confirmVoid() {
    if (
      !(await confirm({
        title: "Void invoice?",
        message: unpaid
          ? `Void invoice ${invoiceNumber}? To correct a price or quantity, use Edit instead. A voided invoice stays on file and can be reopened later.`
          : `Void paid invoice ${invoiceNumber}? It stays on file and can be reopened later.`,
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
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => printPdfUrl(`/api/invoices/${invoiceId}/pdf`)}
        className={plainButtonClassName}
      >
        Print
      </button>
      {canManage && unpaid ? (
        <>
          <Link
            href={`/invoices/${invoiceId}/edit`}
            className={
              needsPrice
                ? "rounded-lg bg-slate-900 px-3 py-1.5 text-2xs font-semibold text-white hover:bg-slate-800"
                : plainButtonClassName
            }
          >
            Edit
          </Link>
          {needsPrice ? null : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAndReload(
                  () => markInvoicePaid(invoiceId),
                  `Invoice ${invoiceNumber} marked paid.`,
                )
              }
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-2xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              Mark paid
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={confirmVoid}
            className={dangerButtonClassName}
          >
            Void
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              if (
                !(await confirm({
                  title: "Delete invoice?",
                  message: `Delete invoice ${invoiceNumber}? Ticket ${ticketNumber} stays delivered. If it should be billed after all, Convert to Invoice on the ticket makes the invoice again.`,
                  confirmLabel: "Delete invoice",
                  variant: "danger",
                }))
              ) {
                return;
              }
              startTransition(async () => {
                const result = await deleteInvoice(invoiceId);
                if (result.error) {
                  window.alert(result.error);
                  return;
                }
                navigateAfterAction("/invoices", {
                  type: "success",
                  text: `Invoice ${invoiceNumber} deleted.`,
                });
              });
            }}
            className={dangerButtonClassName}
          >
            Delete
          </button>
        </>
      ) : null}
      {canManage && status === "PAID" ? (
        <button
          type="button"
          disabled={pending}
          onClick={confirmVoid}
          className={dangerButtonClassName}
        >
          Void
        </button>
      ) : null}
      {canManage && status === "VOID" ? (
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            if (
              !(await confirm({
                title: "Reopen invoice?",
                message: `Reopen voided invoice ${invoiceNumber}? It keeps its number, ticket and lines, and can be edited again.`,
                confirmLabel: "Reopen",
              }))
            ) {
              return;
            }
            runAndReload(
              () => reopenVoidedInvoice(invoiceId),
              `Invoice ${invoiceNumber} reopened.`,
            );
          }}
          className={plainButtonClassName}
        >
          Reopen
        </button>
      ) : null}
    </div>
  );
}
