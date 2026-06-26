"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { savePurchaseReceipt } from "@/app/inventory/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { formatCastingPieceRoleLabel } from "@/lib/casting-utils";

type ProductOption = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
  castingPieceRole: string | null;
};

type AssemblyOption = {
  id: string;
  productCode: string;
  name: string;
  components: Array<{
    pieceRole: string;
    quantity: number;
    component: { id: string; productCode: string; name: string };
  }>;
};

type SupplierOption = {
  id: string;
  name: string;
};

type PurchaseReceiptFormProps = {
  products: ProductOption[];
  assemblies: AssemblyOption[];
  suppliers: SupplierOption[];
};

type ReceiptLineRow = {
  id: string;
  productId: string;
  quantityReceived: string;
};

function createRow(): ReceiptLineRow {
  return {
    id: crypto.randomUUID(),
    productId: "",
    quantityReceived: "",
  };
}

export function PurchaseReceiptForm({
  products,
  assemblies,
  suppliers,
}: PurchaseReceiptFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"piece" | "assembly">("piece");
  const [assemblyId, setAssemblyId] = useState("");
  const [assemblyQty, setAssemblyQty] = useState("1");
  const [lines, setLines] = useState<ReceiptLineRow[]>([createRow()]);

  const selectedAssembly = useMemo(
    () => assemblies.find((entry) => entry.id === assemblyId),
    [assemblies, assemblyId],
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

    if (mode === "assembly") {
      formData.set("assemblyId", assemblyId);
      formData.set("assemblyQty", assemblyQty);
    } else {
      for (const line of lines) {
        if (line.productId && line.quantityReceived) {
          formData.append("productId", line.productId);
          formData.append("quantityReceived", line.quantityReceived);
        }
      }
    }

    startTransition(async () => {
      const result = await savePurchaseReceipt(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/inventory");
      router.refresh();
    });
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <SectionCard title="Receipt Date">
        <div className="grid gap-4 sm:grid-cols-3">
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
            <label htmlFor="supplierId" className="text-xs font-medium text-slate-700">
              Supplier
            </label>
            <select id="supplierId" name="supplierId" className={inputClass}>
              <option value="">— Optional —</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="batchLabel" className="text-xs font-medium text-slate-700">
              Batch / PO reference
            </label>
            <input id="batchLabel" name="batchLabel" className={inputClass} />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="enteredBy" className="text-xs font-medium text-slate-700">
              Received by
            </label>
            <input id="enteredBy" name="enteredBy" className={inputClass} />
          </div>
          <div>
            <label htmlFor="notes" className="text-xs font-medium text-slate-700">
              Notes
            </label>
            <input id="notes" name="notes" className={inputClass} />
          </div>
        </div>
      </SectionCard>

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
            />
            Full casting set (from assembly BOM)
          </label>
        </div>
      </SectionCard>

      {mode === "piece" ? (
        <SectionCard title="Component lines">
          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                <select
                  value={line.productId}
                  onChange={(event) =>
                    updateLine(line.id, { productId: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Select component…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.productCode} — {product.name}
                      {product.castingPieceRole
                        ? ` (${formatCastingPieceRoleLabel(product.castingPieceRole)})`
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
                    updateLine(line.id, { quantityReceived: event.target.value })
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
                {assemblies.map((assembly) => (
                  <option key={assembly.id} value={assembly.id}>
                    {assembly.productCode} — {assembly.name}
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
                  {row.quantity * (Number(assemblyQty) || 0)}: {row.component.productCode} —{" "}
                  {row.component.name}
                </li>
              ))}
            </ul>
          ) : null}
        </SectionCard>
      )}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Link
          href="/inventory"
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Receive Castings"}
        </button>
      </div>
    </form>
  );
}
