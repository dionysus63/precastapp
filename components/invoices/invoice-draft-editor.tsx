"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  saveDraftInvoiceAndRedirect,
  updateDraftInvoice,
  type DraftInvoiceLineInput,
  type UpdateDraftInvoiceInput,
} from "@/app/invoices/actions";
import type { InvoiceLineType } from "@/app/generated/prisma/client";
import { computeMoneyTotals } from "@/lib/money";
import { computeDeliveryAmount } from "@/lib/quotes/money-rules";

type EditorLine = DraftInvoiceLineInput & { clientKey: string };

type InvoiceDraftEditorProps = {
  invoiceId: string;
  invoiceNumber: string;
  ticketNumber: string;
  customerName: string;
  projectName: string;
  initialTaxRate: number;
  initialDiscount: number;
  initialLines: DraftInvoiceLineInput[];
};

function newClientKey(): string {
  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function computePreviewTotals(
  lines: EditorLine[],
  taxRate: number,
  discountAmount: number,
) {
  const computed = computeMoneyTotals(
    lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxable: line.taxable,
    })),
    taxRate,
    discountAmount,
  );
  const deliveryAmount = computeDeliveryAmount(
    lines.map((line) => ({
      lineType: line.lineType,
      itemCode: line.itemCode,
      description: line.description,
    })),
    computed.lineTotals,
  );
  return { computed, deliveryAmount };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function InvoiceDraftEditor({
  invoiceId,
  invoiceNumber,
  ticketNumber,
  customerName,
  projectName,
  initialTaxRate,
  initialDiscount,
  initialLines,
}: InvoiceDraftEditorProps) {
  const [lines, setLines] = useState<EditorLine[]>(
    initialLines.map((line) => ({
      ...line,
      clientKey: line.id ?? newClientKey(),
    })),
  );
  const [deletedLineIds, setDeletedLineIds] = useState<string[]>([]);
  const [taxRate, setTaxRate] = useState(initialTaxRate);
  const [discountAmount, setDiscountAmount] = useState(initialDiscount);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const preview = useMemo(
    () => computePreviewTotals(lines, taxRate, discountAmount),
    [lines, taxRate, discountAmount],
  );

  const buildInput = (): UpdateDraftInvoiceInput => ({
    invoiceId,
    taxRate,
    discountAmount,
    deletedLineIds,
    lines: lines.map((line, index) => ({
      id: line.id,
      lineNumber: index + 1,
      lineType: line.lineType,
      itemCode: line.itemCode,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      taxable: line.taxable,
    })),
  });

  const updateLine = (
    clientKey: string,
    patch: Partial<EditorLine>,
  ) => {
    setLines((current) =>
      current.map((line) =>
        line.clientKey === clientKey ? { ...line, ...patch } : line,
      ),
    );
  };

  const removeLine = (clientKey: string) => {
    setLines((current) => {
      const target = current.find((line) => line.clientKey === clientKey);
      if (target?.id) {
        setDeletedLineIds((ids) => [...ids, target.id!]);
      }
      return current.filter((line) => line.clientKey !== clientKey);
    });
  };

  const addLine = (lineType: InvoiceLineType) => {
    setLines((current) => [
      ...current,
      {
        clientKey: newClientKey(),
        lineNumber: current.length + 1,
        lineType,
        itemCode: lineType === "SERVICE" ? "Delivery" : "",
        description: lineType === "SERVICE" ? "Delivery charge" : "",
        quantity: 1,
        unit: "EA",
        unitPrice: 0,
        taxable: true,
      },
    ]);
  };

  const save = (redirectAfter: boolean) => {
    startTransition(async () => {
      const input = buildInput();
      if (redirectAfter) {
        const result = await saveDraftInvoiceAndRedirect(input);
        if (result?.error) setMessage(result.error);
        return;
      }
      const result = await updateDraftInvoice(input);
      setMessage(result.error ?? "Draft saved.");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/invoices/${invoiceId}`}
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to invoice
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => save(false)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save(true)}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Save &amp; view
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {message}
        </p>
      ) : null}

      <SectionCard title={`Edit draft ${invoiceNumber}`}>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div>
            <dt className="text-slate-500">Customer</dt>
            <dd className="mt-1 font-medium text-slate-900">{customerName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Project</dt>
            <dd className="mt-1 font-medium text-slate-900">{projectName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Delivery ticket</dt>
            <dd className="mt-1 font-medium text-slate-900">{ticketNumber}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Line items" noPadding>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 font-semibold">Description</th>
                <th className="px-3 py-2 font-semibold">Qty</th>
                <th className="px-3 py-2 font-semibold">Unit</th>
                <th className="px-3 py-2 font-semibold">Unit price</th>
                <th className="px-3 py-2 font-semibold">Taxable</th>
                <th className="px-3 py-2 font-semibold">Total</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, index) => (
                <tr key={line.clientKey}>
                  <td className="px-3 py-2">
                    <select
                      value={line.lineType}
                      onChange={(event) =>
                        updateLine(line.clientKey, {
                          lineType: event.target.value as InvoiceLineType,
                        })
                      }
                      className="rounded border border-slate-200 px-1.5 py-1"
                    >
                      {[
                        "STOCK_PRODUCT",
                        "CONFIGURABLE_STRUCTURE",
                        "CUSTOM_STRUCTURE",
                        "SERVICE",
                        "MISC",
                      ].map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={line.itemCode}
                      onChange={(event) =>
                        updateLine(line.clientKey, {
                          itemCode: event.target.value,
                        })
                      }
                      className="w-28 rounded border border-slate-200 px-1.5 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={line.description}
                      onChange={(event) =>
                        updateLine(line.clientKey, {
                          description: event.target.value,
                        })
                      }
                      className="min-w-[12rem] rounded border border-slate-200 px-1.5 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.clientKey, {
                          quantity: Number(event.target.value),
                        })
                      }
                      className="w-20 rounded border border-slate-200 px-1.5 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={line.unit}
                      onChange={(event) =>
                        updateLine(line.clientKey, { unit: event.target.value })
                      }
                      className="w-16 rounded border border-slate-200 px-1.5 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(event) =>
                        updateLine(line.clientKey, {
                          unitPrice: Number(event.target.value),
                        })
                      }
                      className="w-24 rounded border border-slate-200 px-1.5 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={line.taxable}
                      onChange={(event) =>
                        updateLine(line.clientKey, {
                          taxable: event.target.checked,
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {formatMoney(
                      Number(preview.computed.lineTotals[index]?.toString() ?? 0),
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeLine(line.clientKey)}
                      className="text-red-700 underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-3">
          <button
            type="button"
            onClick={() => addLine("MISC")}
            className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
          >
            Add misc line
          </button>
          <button
            type="button"
            onClick={() => addLine("SERVICE")}
            className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
          >
            Add delivery / service
          </button>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <SectionCard title="Tax & discount">
          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <label className="block">
              <span className="text-slate-600">Tax rate (%)</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={taxRate}
                onChange={(event) => setTaxRate(Number(event.target.value))}
                className="mt-1 block w-full rounded border border-slate-200 px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="text-slate-600">Discount ($)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(event) =>
                  setDiscountAmount(Number(event.target.value))
                }
                className="mt-1 block w-full rounded border border-slate-200 px-2 py-1.5"
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Preview totals">
          <dl className="space-y-2 text-xs">
            {[
              ["Subtotal", preview.computed.subtotal.toNumber()],
              ["Delivery", preview.deliveryAmount.toNumber()],
              ["Discount", discountAmount],
              ["Taxable", preview.computed.taxableAmount.toNumber()],
              ["Sales tax", preview.computed.salesTax.toNumber()],
              ["Total", preview.computed.total.toNumber()],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-medium text-slate-900">
                  {formatMoney(Number(value))}
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}
