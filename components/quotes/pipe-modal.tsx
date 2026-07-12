"use client";

import { useMemo, useState } from "react";
import {
  type EditableQuoteLineItem,
  type QuotePipeProductOption,
  formatQuoteCurrency,
  quoteInputClassName,
} from "@/components/quotes/quote-utils";
import {
  computePipeLineWeightLb,
  filterPipeProductsByType,
  formatPipeQuoteLabel,
  formatPipeQuoteLineDescription,
  formatPipeStickRoundUpSummary,
  formatPipeUnitPrice,
  type PipeQuoteProductType,
  type PipeUnitPriceEntry,
  roundPipeFeetToSticks,
} from "@/lib/pipe-quote-utils";

import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableHeaderCellClassName,
  tableInlineInputClassName,
  tableWrapperClassName,
} from "@/lib/table-styles";
type PipeModalMode = "choose" | "quote" | "unitPrices";

type PipeQuoteRow = {
  id: string;
  productId: string;
  feet: string;
};

type PipeModalProps = {
  open: boolean;
  onClose: () => void;
  pipeType: PipeQuoteProductType;
  pipeProducts: QuotePipeProductOption[];
  lineCount: number;
  onAddItems: (items: EditableQuoteLineItem[]) => void;
  onAddUnitPrices: (entries: PipeUnitPriceEntry[]) => void;
  onError: (message: string) => void;
};

function createRowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultQuoteRow(products: QuotePipeProductOption[]): PipeQuoteRow {
  return {
    id: createRowId("pipe-row"),
    productId: products[0]?.id ?? "",
    feet: "",
  };
}

function pipeTypeLabel(pipeType: PipeQuoteProductType): string {
  return pipeType === "ADS_PIPE" ? "ADS Pipe" : "RCP Pipe";
}

function pipeTypeLineLabel(pipeType: PipeQuoteProductType): string {
  return pipeType === "ADS_PIPE" ? "ADS Pipe" : "RCP";
}

export function PipeModal({
  open,
  onClose,
  pipeType,
  pipeProducts,
  lineCount,
  onAddItems,
  onAddUnitPrices,
  onError,
}: PipeModalProps) {
  const [mode, setMode] = useState<PipeModalMode>("choose");
  const [quoteRows, setQuoteRows] = useState<PipeQuoteRow[]>([]);
  const [selectedUnitPriceIds, setSelectedUnitPriceIds] = useState<Set<string>>(
    () => new Set(),
  );

  const productsForType = useMemo(
    () => filterPipeProductsByType(pipeProducts, pipeType),
    [pipeProducts, pipeType],
  );

  const productById = useMemo(() => {
    const map = new Map<string, QuotePipeProductOption>();
    for (const product of productsForType) {
      map.set(product.id, product);
    }
    return map;
  }, [productsForType]);

  // Reset the modal whenever it opens or its product set changes while open.
  // Done during render (guarded) instead of an effect; productsForType's
  // identity also changes with pipeType.
  const [prevReset, setPrevReset] = useState<{
    open: boolean;
    products: QuotePipeProductOption[];
  } | null>(null);
  if (prevReset?.open !== open || prevReset?.products !== productsForType) {
    setPrevReset({ open, products: productsForType });
    if (open) {
      setMode("choose");
      setQuoteRows(
        productsForType.length > 0 ? [createDefaultQuoteRow(productsForType)] : [],
      );
      setSelectedUnitPriceIds(new Set());
    }
  }

  function resetModal() {
    setMode("choose");
    setQuoteRows([]);
    setSelectedUnitPriceIds(new Set());
  }

  function handleClose() {
    resetModal();
    onClose();
  }

  function updateQuoteRow(
    id: string,
    field: keyof Omit<PipeQuoteRow, "id">,
    value: string,
  ) {
    setQuoteRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function toggleUnitPriceSelection(productId: string) {
    setSelectedUnitPriceIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  function handleAddQuoteLines() {
    if (productsForType.length === 0) {
      onError(`No active ${pipeTypeLabel(pipeType)} products are available.`);
      return;
    }

    const items: EditableQuoteLineItem[] = [];
    let nextLineNumber = lineCount + 1;

    for (const row of quoteRows) {
      if (!row.feet.trim()) {
        continue;
      }

      const product = productById.get(row.productId);
      if (!product) {
        onError("Choose a pipe size for each row.");
        return;
      }

      const requestedFeet = Number(row.feet);
      if (!Number.isFinite(requestedFeet) || requestedFeet <= 0) {
        onError("Enter footage greater than zero for each pipe row.");
        return;
      }

      const roundedFeet = roundPipeFeetToSticks(
        requestedFeet,
        product.pipeLengthFeet,
      );
      const lineWeight = computePipeLineWeightLb(product, roundedFeet);

      items.push({
        id: createRowId("line"),
        lineNumber: nextLineNumber++,
        type: "STOCK_PRODUCT",
        typeLabel: pipeTypeLineLabel(pipeType),
        item: product.code,
        description: formatPipeQuoteLineDescription(
          product,
          requestedFeet,
          roundedFeet,
        ),
        qty: String(roundedFeet),
        unit: "LF",
        unitPrice: formatPipeUnitPrice(product.unitPrice),
        weight: lineWeight > 0 ? String(lineWeight) : "",
        yards: "",
        taxable: product.taxable,
        productId: product.id,
      });
    }

    if (items.length === 0) {
      onError("Add at least one pipe row with footage.");
      return;
    }

    onAddItems(items);
    handleClose();
  }

  function handleAddUnitPricesToDescription() {
    if (selectedUnitPriceIds.size === 0) {
      onError("Select at least one pipe diameter to add.");
      return;
    }

    const entries: PipeUnitPriceEntry[] = [];
    for (const productId of selectedUnitPriceIds) {
      const product = productById.get(productId);
      if (!product) {
        continue;
      }
      entries.push({
        label: formatPipeQuoteLabel(product),
        pricePerFoot: product.unitPrice,
      });
    }

    if (entries.length === 0) {
      onError("Select at least one pipe diameter to add.");
      return;
    }

    onAddUnitPrices(entries);
    handleClose();
  }

  if (!open) {
    return null;
  }

  if (productsForType.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <h3 className="text-sm font-semibold text-slate-900">
            Add {pipeTypeLabel(pipeType)}
          </h3>
          <p className="mt-2 text-xs text-slate-600">
            No active {pipeTypeLabel(pipeType)} products were found for the
            selected price list.
          </p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-slate-900">
          Add {pipeTypeLabel(pipeType)}
        </h3>

        {mode === "choose" ? (
          <>
            <p className="mt-1 text-xs text-slate-500">
              Add pipe to the quote by the foot, or list unit prices in the
              description for contractor takeoff.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("quote")}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
              >
                <p className="text-xs font-semibold text-slate-900">
                  Add pipe to the quote
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  Enter footage by diameter. Footage rounds up to full{" "}
                  {pipeType === "ADS_PIPE" ? "20'" : "8'"} sections and quotes
                  at $/LF.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode("unitPrices")}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
              >
                <p className="text-xs font-semibold text-slate-900">
                  Add unit prices to description
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  Adds a Pipe Unit Prices block to the last line of the quote
                  without billing those diameters.
                </p>
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </>
        ) : null}

        {mode === "quote" ? (
          <>
            <p className="mt-1 text-xs text-slate-500">
              Enter requested footage for each diameter. The quote will round up
              to the next full {pipeType === "ADS_PIPE" ? "20'" : "8'"}{" "}
              section.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-slate-900">
                  Pipe rows
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    setQuoteRows((current) => [
                      ...current,
                      createDefaultQuoteRow(productsForType),
                    ])
                  }
                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Add row
                </button>
              </div>
              <div className={tableWrapperClassName}>
                <table className={tableClassName}>
                  <thead>
                    <tr>
                      <th className={tableHeaderCellClassName}>Pipe</th>
                      <th className={tableHeaderCellClassName}>Footage</th>
                      <th className={tableHeaderCellClassName}>Rounded</th>
                      <th className={tableHeaderCellClassName}>$/LF</th>
                      <th className={tableHeaderCellClassName}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={tableBodyClassName}>
                    {quoteRows.map((row) => {
                      const product = productById.get(row.productId);
                      const requestedFeet = Number(row.feet);
                      const roundedFeet =
                        product &&
                        Number.isFinite(requestedFeet) &&
                        requestedFeet > 0
                          ? roundPipeFeetToSticks(
                              requestedFeet,
                              product.pipeLengthFeet,
                            )
                          : null;
                      const lineTotal =
                        roundedFeet != null && product
                          ? roundedFeet * product.unitPrice
                          : null;

                      return (
                        <tr key={row.id}>
                          <td className={`${tableCellClassName} min-w-[14rem]`}>
                            <select
                              value={row.productId}
                              onChange={(event) =>
                                updateQuoteRow(
                                  row.id,
                                  "productId",
                                  event.target.value,
                                )
                              }
                              className={quoteInputClassName}
                            >
                              {productsForType.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {formatPipeQuoteLabel(option)} ({option.code})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={tableCellClassName}>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={row.feet}
                              onChange={(event) =>
                                updateQuoteRow(row.id, "feet", event.target.value)
                              }
                              placeholder="LF"
                              className={`${tableInlineInputClassName} w-24 text-right tabular-nums`}
                            />
                          </td>
                          <td className={`${tableCellClassName} text-slate-600`}>
                            {product &&
                            Number.isFinite(requestedFeet) &&
                            requestedFeet > 0
                              ? formatPipeStickRoundUpSummary(
                                  requestedFeet,
                                  product.pipeLengthFeet,
                                )
                              : "—"}
                          </td>
                          <td className={`${tableCellClassName} text-slate-600`}>
                            {product ? formatQuoteCurrency(product.unitPrice) : "—"}
                            {lineTotal != null ? (
                              <span className="block text-[11px] text-slate-500">
                                Line {formatQuoteCurrency(lineTotal)}
                              </span>
                            ) : null}
                          </td>
                          <td className={tableCellClassName}>
                            <button
                              type="button"
                              onClick={() =>
                                setQuoteRows((current) =>
                                  current.length > 1
                                    ? current.filter((entry) => entry.id !== row.id)
                                    : current,
                                )
                              }
                              disabled={quoteRows.length <= 1}
                              className="rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-4 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddQuoteLines}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Add to Quote
                </button>
              </div>
            </div>
          </>
        ) : null}

        {mode === "unitPrices" ? (
          <>
            <p className="mt-1 text-xs text-slate-500">
              Selected diameters will be added to a Pipe Unit Prices block at the
              bottom of the quote.
            </p>
            <div className="mt-4 max-h-[24rem] overflow-y-auto rounded-lg border border-slate-100">
              <ul className="divide-y divide-slate-100">
                {productsForType.map((product) => {
                  const checked = selectedUnitPriceIds.has(product.id);
                  return (
                    <li key={product.id}>
                      <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUnitPriceSelection(product.id)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-slate-900">
                            {formatPipeQuoteLabel(product)}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {product.code} ·{" "}
                            {formatQuoteCurrency(product.unitPrice)}/LF
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mt-4 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddUnitPricesToDescription}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Add to Description
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
