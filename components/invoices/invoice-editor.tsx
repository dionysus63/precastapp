"use client";

import { useMemo, useState, useTransition } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  saveInvoiceAndRedirect,
  updateInvoice,
  type InvoiceLineInput,
  type UpdateInvoiceInput,
} from "@/app/invoices/actions";
import type { InvoiceLineType } from "@/app/generated/prisma/client";
import { computeMoneyTotals } from "@/lib/money";
import { printPdfUrl } from "@/lib/print-pdf-url";
import { computeDeliveryAmount } from "@/lib/quotes/money-rules";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
  tableInlineInputClassName,
} from "@/lib/table-styles";
import { BackButton } from "@/components/dashboard/back-button";

type EditorLine = InvoiceLineInput & {
  clientKey: string;
  /**
   * Still waiting for a price: the price box is empty and the invoice prints
   * PRICE NEEDED. Typing any price, 0 included, clears it.
   */
  needsPrice: boolean;
  /**
   * The saved invoice still has this line waiting for a price, so emptying
   * the box puts it back to "price needed" instead of $0.00.
   */
  canNeedPrice: boolean;
};

type InvoiceEditorProps = {
  invoiceId: string;
  invoiceNumber: string;
  ticketNumber: string;
  customerName: string;
  projectName: string;
  initialTaxRate: number;
  initialDiscount: number;
  initialLines: InvoiceLineInput[];
};

/** The price box of a line that still needs a price: always outlined. */
const priceNeededInputClassName =
  "rounded-sm border border-amber-500 bg-white px-1.5 py-0.5 text-xs text-slate-900 placeholder:text-amber-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500";

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

export function InvoiceEditor({
  invoiceId,
  invoiceNumber,
  ticketNumber,
  customerName,
  projectName,
  initialTaxRate,
  initialDiscount,
  initialLines,
}: InvoiceEditorProps) {
  const [lines, setLines] = useState<EditorLine[]>(
    initialLines.map((line) => ({
      ...line,
      clientKey: line.id ?? newClientKey(),
      needsPrice: line.needsPrice === true,
      canNeedPrice: line.needsPrice === true,
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

  const priceNeededCount = lines.filter((line) => line.needsPrice).length;

  const buildInput = (): UpdateInvoiceInput => ({
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
      needsPrice: line.needsPrice,
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
        // A line added by hand is priced by hand: $0 here means no charge.
        needsPrice: false,
        canNeedPrice: false,
        taxable: true,
      },
    ]);
  };

  /**
   * Save and stay on this screen. Resolves true when the invoice was saved.
   */
  const saveInPlace = async (): Promise<boolean> => {
    const input = buildInput();
    const sentKeys = lines.map((line) => line.clientKey);
    const sentNeedsPrice = lines.map((line) => line.needsPrice);
    const sentDeletedIds = input.deletedLineIds;
    const result = await updateInvoice(input);
    if (!result.lineIds) {
      setMessage(result.error ?? "Could not save the invoice.");
      return false;
    }
    const savedIds = result.lineIds;
    setLines((current) =>
      current.map((line) => {
        const index = sentKeys.indexOf(line.clientKey);
        if (index < 0) {
          return line;
        }
        return {
          ...line,
          // Give newly created lines their ids so the next save updates them
          // instead of inserting them again.
          id: line.id ?? savedIds[index],
          // What was just saved decides whether the line can still go back
          // to "price needed".
          canNeedPrice: sentNeedsPrice[index] === true,
        };
      }),
    );
    setDeletedLineIds((ids) => ids.filter((id) => !sentDeletedIds.includes(id)));
    return true;
  };

  const save = (after: "stay" | "view" | "print") => {
    setMessage(null);
    startTransition(async () => {
      if (after === "view") {
        const result = await saveInvoiceAndRedirect(buildInput());
        if (result?.error) setMessage(result.error);
        return;
      }
      const saved = await saveInPlace();
      if (!saved) {
        return;
      }
      if (after === "print") {
        // Printed from the saved invoice, so the paper always matches what
        // is on file.
        printPdfUrl(`/api/invoices/${invoiceId}/pdf`);
        setMessage("Invoice saved. Sending it to the printer.");
        return;
      }
      setMessage("Invoice saved.");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton href={`/invoices/${invoiceId}`} label="Back to invoice" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => save("stay")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save("view")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Save &amp; view
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save("print")}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Save &amp; Print
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {message}
        </p>
      ) : null}

      {priceNeededCount > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          {priceNeededCount === 1
            ? "1 line is waiting for a price."
            : `${priceNeededCount} lines are waiting for a price.`}{" "}
          Type the price in the highlighted box, or 0 if there is no charge.
          PRICE NEEDED prints across the invoice until every line has one.
        </p>
      ) : null}

      <SectionCard title={`Edit ${invoiceNumber}`}>
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
        <div className={tableFlushWrapperClassName}>
          <table className={tableClassName}>
            <thead>
              <tr>
                <th className={tableHeaderCellClassName}>Type</th>
                <th className={tableHeaderCellClassName}>Item</th>
                <th className={tableHeaderCellClassName}>Description</th>
                <th className={tableHeaderCellClassName}>Qty</th>
                <th className={tableHeaderCellClassName}>Unit</th>
                <th className={tableHeaderCellClassName}>Unit price</th>
                <th className={tableHeaderCellClassName}>Taxable</th>
                <th className={tableHeaderCellClassName}>Total</th>
                <th className={tableHeaderCellClassName} />
              </tr>
            </thead>
            <tbody className={tableBodyClassName}>
              {lines.map((line, index) => (
                <tr
                  key={line.clientKey}
                  className={line.needsPrice ? "bg-amber-50" : undefined}
                >
                  <td className={tableCellClassName}>
                    <select
                      value={line.lineType}
                      onChange={(event) =>
                        updateLine(line.clientKey, {
                          lineType: event.target.value as InvoiceLineType,
                        })
                      }
                      className={`${tableInlineInputClassName} cursor-pointer`}
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
                  <td className={tableCellClassName}>
                    <input
                      value={line.itemCode}
                      onChange={(event) =>
                        updateLine(line.clientKey, {
                          itemCode: event.target.value,
                        })
                      }
                      className={`${tableInlineInputClassName} w-28`}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      value={line.description}
                      onChange={(event) =>
                        updateLine(line.clientKey, {
                          description: event.target.value,
                        })
                      }
                      className={`${tableInlineInputClassName} w-full min-w-[12rem]`}
                    />
                  </td>
                  <td className={tableCellClassName}>
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
                      className={`${tableInlineInputClassName} w-20 text-right tabular-nums`}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      value={line.unit}
                      onChange={(event) =>
                        updateLine(line.clientKey, { unit: event.target.value })
                      }
                      className={`${tableInlineInputClassName} w-16`}
                    />
                  </td>
                  <td className={tableCellClassName}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label={`Unit price for ${line.itemCode || `line ${index + 1}`}`}
                      value={line.needsPrice ? "" : line.unitPrice}
                      placeholder={line.needsPrice ? "Price" : undefined}
                      onChange={(event) => {
                        const raw = event.target.value;
                        // Emptying the box on a line that is still waiting
                        // for a price puts it back to "price needed"; any
                        // number, 0 included, is a price.
                        updateLine(
                          line.clientKey,
                          raw === "" && line.canNeedPrice
                            ? { unitPrice: 0, needsPrice: true }
                            : { unitPrice: Number(raw), needsPrice: false },
                        );
                      }}
                      className={`${
                        line.needsPrice
                          ? priceNeededInputClassName
                          : tableInlineInputClassName
                      } w-24 text-right tabular-nums`}
                    />
                    {line.needsPrice ? (
                      <span className="mt-1 block text-3xs font-semibold text-amber-800">
                        Price needed
                      </span>
                    ) : null}
                  </td>
                  <td className={tableCellClassName}>
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
                  <td className={`${tableCellClassName} font-medium`}>
                    {line.needsPrice
                      ? "—"
                      : formatMoney(
                          Number(
                            preview.computed.lineTotals[index]?.toString() ?? 0,
                          ),
                        )}
                  </td>
                  <td className={tableCellClassName}>
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
            className="rounded border border-slate-200 px-2 py-1 text-2xs hover:bg-slate-50"
          >
            Add misc line
          </button>
          <button
            type="button"
            onClick={() => addLine("SERVICE")}
            className="rounded border border-slate-200 px-2 py-1 text-2xs hover:bg-slate-50"
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
          {priceNeededCount > 0 ? (
            <p className="mt-3 text-2xs font-medium text-amber-800">
              {priceNeededCount === 1
                ? "Without the 1 line still waiting for a price."
                : `Without the ${priceNeededCount} lines still waiting for a price.`}
            </p>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}
