"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProductionEntry } from "@/app/operations/actions";
import { SectionCard } from "@/components/dashboard/section-card";

type ProductOption = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
};

type ProductionLineRow = {
  id: string;
  productId: string;
  quantityProduced: string;
};

type ProductionEntryFormProps = {
  products: ProductOption[];
};

function createRow(): ProductionLineRow {
  return {
    id: crypto.randomUUID(),
    productId: "",
    quantityProduced: "",
  };
}

export function ProductionEntryForm({ products }: ProductionEntryFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<ProductionLineRow[]>([createRow()]);

  function addLine() {
    setLines((current) => [...current, createRow()]);
  }

  function updateLine(id: string, patch: Partial<ProductionLineRow>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    for (const line of lines) {
      if (line.productId && line.quantityProduced) {
        formData.append("productId", line.productId);
        formData.append("quantityProduced", line.quantityProduced);
      }
    }

    startTransition(async () => {
      const result = await saveProductionEntry(formData);
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
      <SectionCard title="Production Date">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="productionDate" className="text-xs font-medium text-slate-700">
              Date
            </label>
            <input
              id="productionDate"
              name="productionDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="enteredBy" className="text-xs font-medium text-slate-700">
              Entered By
            </label>
            <input id="enteredBy" name="enteredBy" type="text" className={inputClass} />
          </div>
          <div className="sm:col-span-1">
            <label htmlFor="notes" className="text-xs font-medium text-slate-700">
              Notes
            </label>
            <input id="notes" name="notes" type="text" className={inputClass} />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Products Made"
        action={
          <button
            type="button"
            onClick={addLine}
            className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
          >
            Add row
          </button>
        }
      >
        <div className="space-y-3">
          {lines.map((line) => (
            <div key={line.id} className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-700">Product</label>
                <select
                  value={line.productId}
                  onChange={(event) =>
                    updateLine(line.id, { productId: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Select product…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.productCode} — {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Qty made</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={line.quantityProduced}
                  onChange={(event) =>
                    updateLine(line.id, { quantityProduced: event.target.value })
                  }
                  className={inputClass}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Link
          href="/inventory"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Production Entry"}
        </button>
      </div>
    </form>
  );
}
