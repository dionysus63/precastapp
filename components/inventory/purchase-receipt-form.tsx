"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { savePurchaseReceipt } from "@/app/inventory/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  buildPrefilledReceiptLines,
  PurchaseOrderReceiptBanner,
  type PurchaseOrderReceiptOption,
} from "@/components/receiving/purchase-order-receipt-banner";
import {
  formatCastingPieceRoleLabel,
  formatCastingSupplierOriginLabel,
  type CastingPieceRole,
} from "@/lib/casting-utils";
import { formatCastingReceiptLabel } from "@/lib/casting-service";

type ProductOption = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
  castingPieceRole: CastingPieceRole | null;
  castingRole?: string | null;
  castingSoldAsUnit?: boolean;
  manufacturerCode?: string | null;
  castingSupplierId?: string | null;
};

type AssemblyOption = {
  id: string;
  productCode: string;
  name: string;
  manufacturerCode?: string | null;
  castingSupplierId?: string | null;
  components: Array<{
    pieceRole: CastingPieceRole;
    quantity: number;
    component: { id: string; productCode: string; name: string };
  }>;
};

type SupplierOption = {
  id: string;
  name: string;
  origin?: "DOMESTIC" | "IMPORTED";
};

type PurchaseReceiptFormProps = {
  products: ProductOption[];
  assemblies: AssemblyOption[];
  suppliers: SupplierOption[];
  category?: "DOMESTIC_CASTINGS" | "IMPORTED_CASTINGS";
  returnPath?: string;
  lockedPurchaseOrder?: PurchaseOrderReceiptOption | null;
  openPurchaseOrders?: PurchaseOrderReceiptOption[];
};

type ReceiptLineRow = {
  id: string;
  productId: string;
  quantityReceived: string;
};

function createRow(productId = "", quantityReceived = ""): ReceiptLineRow {
  return {
    id: crypto.randomUUID(),
    productId,
    quantityReceived,
  };
}

function prefillRowsFromPurchaseOrder(
  purchaseOrder: PurchaseOrderReceiptOption | null | undefined,
): ReceiptLineRow[] | null {
  if (!purchaseOrder) {
    return null;
  }
  const prefilled = buildPrefilledReceiptLines(purchaseOrder);
  if (prefilled.length === 0) {
    return null;
  }
  return prefilled.map((line) =>
    createRow(line.productId, line.quantityReceived),
  );
}

export function PurchaseReceiptForm({
  products,
  assemblies,
  suppliers,
  category,
  returnPath = "/inventory/receipts",
  lockedPurchaseOrder = null,
  openPurchaseOrders = [],
}: PurchaseReceiptFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState(
    lockedPurchaseOrder?.id ?? "",
  );
  const [mode, setMode] = useState<"piece" | "assembly" | "unit">("piece");
  const [assemblyId, setAssemblyId] = useState("");
  const [assemblyQty, setAssemblyQty] = useState("1");
  const [lines, setLines] = useState<ReceiptLineRow[]>(
    () => prefillRowsFromPurchaseOrder(lockedPurchaseOrder) ?? [createRow()],
  );
  const [submissionKey] = useState(() => crypto.randomUUID());

  // Prefill happens on the selection event (and lazily above for a locked PO)
  // so a server-props refresh can't overwrite quantities the user edited.
  function handleSelectPurchaseOrder(purchaseOrderId: string) {
    setSelectedPurchaseOrderId(purchaseOrderId);
    const purchaseOrder =
      openPurchaseOrders.find((po) => po.id === purchaseOrderId) ?? null;
    const prefilledRows = prefillRowsFromPurchaseOrder(purchaseOrder);
    if (prefilledRows) {
      setMode("piece");
      setLines(prefilledRows);
    }
  }

  const filteredSuppliers = useMemo(() => {
    if (!category) {
      return suppliers;
    }
    const origin = category === "DOMESTIC_CASTINGS" ? "DOMESTIC" : "IMPORTED";
    return suppliers.filter((supplier) => supplier.origin === origin);
  }, [suppliers, category]);

  const selectedSupplier = useMemo(
    () => filteredSuppliers.find((entry) => entry.id === supplierId),
    [filteredSuppliers, supplierId],
  );

  const supplierProducts = useMemo(() => {
    if (!supplierId) {
      return products;
    }
    return products.filter((product) => product.castingSupplierId === supplierId);
  }, [products, supplierId]);

  const supplierAssemblies = useMemo(() => {
    if (!supplierId) {
      return assemblies;
    }
    return assemblies.filter(
      (assembly) => assembly.castingSupplierId === supplierId,
    );
  }, [assemblies, supplierId]);

  const unitCastings = useMemo(
    () => supplierProducts.filter((product) => product.castingSoldAsUnit),
    [supplierProducts],
  );

  const componentProducts = useMemo(
    () => supplierProducts.filter((product) => product.castingRole === "COMPONENT"),
    [supplierProducts],
  );

  const selectedAssembly = useMemo(
    () => supplierAssemblies.find((entry) => entry.id === assemblyId),
    [supplierAssemblies, assemblyId],
  );

  function addLine() {
    setLines((current) => [...current, createRow()]);
  }

  function updateLine(id: string, patch: Partial<ReceiptLineRow>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("supplierId", supplierId);
    if (category) {
      formData.set("category", category);
    }
    formData.set("returnPath", returnPath);
    if (selectedPurchaseOrderId) {
      formData.set("purchaseOrderId", selectedPurchaseOrderId);
    }

    if (mode === "assembly") {
      formData.set("assemblyId", assemblyId);
      formData.set("assemblyQty", assemblyQty);
    } else if (mode === "unit") {
      for (const line of lines) {
        if (line.productId && line.quantityReceived) {
          formData.append("productId", line.productId);
          formData.append("quantityReceived", line.quantityReceived);
        }
      }
    } else {
      for (const line of lines) {
        if (line.productId && line.quantityReceived) {
          formData.append("productId", line.productId);
          formData.append("quantityReceived", line.quantityReceived);
        }
      }
    }

    startTransition(async () => {
      formData.set("submissionKey", submissionKey);
      const result = await savePurchaseReceipt(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(result.returnPath ?? returnPath);
      router.refresh();
    });
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

  const activeProductOptions =
    mode === "unit" ? unitCastings : componentProducts;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PurchaseOrderReceiptBanner
        lockedPurchaseOrder={lockedPurchaseOrder}
        openPurchaseOrders={openPurchaseOrders}
        selectedPurchaseOrderId={selectedPurchaseOrderId}
        onSelectPurchaseOrderId={handleSelectPurchaseOrder}
      />

      <SectionCard title="Supplier & receipt details">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label htmlFor="supplierId" className="text-xs font-medium text-slate-700">
              Supplier *
            </label>
            <select
              id="supplierId"
              required
              value={supplierId}
              onChange={(event) => {
                setSupplierId(event.target.value);
                setAssemblyId("");
                setLines([createRow()]);
              }}
              className={inputClass}
            >
              <option value="">Select supplier…</option>
              {filteredSuppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                  {supplier.origin
                    ? ` (${formatCastingSupplierOriginLabel(supplier.origin)})`
                    : ""}
                </option>
              ))}
            </select>
            {selectedSupplier?.origin ? (
              <p className="mt-2 text-xs text-slate-600">
                Origin:{" "}
                <span className="font-medium">
                  {formatCastingSupplierOriginLabel(selectedSupplier.origin)}
                </span>
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="receiptDate" className="text-xs font-medium text-slate-700">
              Date
            </label>
            <input
              id="receiptDate"
              name="receiptDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="batchLabel" className="text-xs font-medium text-slate-700">
              Batch / PO reference
            </label>
            <input id="batchLabel" name="batchLabel" className={inputClass} />
          </div>
          <div>
            <label htmlFor="enteredBy" className="text-xs font-medium text-slate-700">
              Received by
            </label>
            <input id="enteredBy" name="enteredBy" className={inputClass} />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="notes" className="text-xs font-medium text-slate-700">
            Notes
          </label>
          <input id="notes" name="notes" className={inputClass} />
        </div>
      </SectionCard>

      {!supplierId ? (
        <SectionCard title="Receive lines">
          <p className="text-sm text-slate-600">
            Choose a supplier first to see the castings available to receive.
          </p>
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Receive mode">
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="receiveMode"
                  checked={mode === "piece"}
                  onChange={() => setMode("piece")}
                />
                By piece (frame, cover, grate)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="receiveMode"
                  checked={mode === "assembly"}
                  onChange={() => setMode("assembly")}
                  disabled={supplierAssemblies.length === 0}
                />
                Full casting set (BOM expansion)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="receiveMode"
                  checked={mode === "unit"}
                  onChange={() => setMode("unit")}
                  disabled={unitCastings.length === 0}
                />
                One-piece unit castings
              </label>
            </div>
          </SectionCard>

          {mode === "piece" || mode === "unit" ? (
            <SectionCard
              title={
                mode === "unit"
                  ? "One-piece unit lines"
                  : "Component lines"
              }
            >
              <div className="space-y-3">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]"
                  >
                    <select
                      value={line.productId}
                      onChange={(event) =>
                        updateLine(line.id, { productId: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">
                        {mode === "unit"
                          ? "Select one-piece casting…"
                          : "Select component…"}
                      </option>
                      {activeProductOptions.map((product) => (
                        <option key={product.id} value={product.id}>
                          {formatCastingReceiptLabel(product)}
                          {product.castingPieceRole
                            ? ` (${formatCastingPieceRoleLabel(product.castingPieceRole)})`
                            : mode === "unit"
                              ? " (one-piece unit)"
                              : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Qty"
                      value={line.quantityReceived}
                      onChange={(event) =>
                        updateLine(line.id, {
                          quantityReceived: event.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addLine}
                className="mt-3 text-xs font-medium text-slate-700 underline"
              >
                Add line
              </button>
            </SectionCard>
          ) : (
            <SectionCard title="Full casting set">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="assemblyId" className="text-xs font-medium text-slate-700">
                    Assembly
                  </label>
                  <select
                    id="assemblyId"
                    value={assemblyId}
                    onChange={(event) => setAssemblyId(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select assembly…</option>
                    {supplierAssemblies.map((assembly) => (
                      <option key={assembly.id} value={assembly.id}>
                        {formatCastingReceiptLabel(assembly)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="assemblyQty" className="text-xs font-medium text-slate-700">
                    Number of full sets
                  </label>
                  <input
                    id="assemblyQty"
                    type="number"
                    min="1"
                    step="1"
                    value={assemblyQty}
                    onChange={(event) => setAssemblyQty(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              {selectedAssembly ? (
                <ul className="mt-4 space-y-1 text-xs text-slate-600">
                  {selectedAssembly.components.map((row) => (
                    <li key={row.component.id}>
                      {formatCastingPieceRoleLabel(row.pieceRole)} ×{" "}
                      {row.quantity * (Number(assemblyQty) || 0)}:{" "}
                      {row.component.productCode} — {row.component.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </SectionCard>
          )}
        </>
      )}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Link
          href={returnPath.startsWith("/receiving") ? "/receiving" : "/inventory"}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending || !supplierId}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Receive Castings"}
        </button>
      </div>
    </form>
  );
}
