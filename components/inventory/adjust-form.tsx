"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { saveInventoryAdjustment } from "@/app/inventory/actions";
import { SectionCard } from "@/components/dashboard/section-card";

type ProductOption = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
  currentStockQuantity: number;
};

type AdjustFormProps = {
  products: ProductOption[];
  defaultProductId?: string;
};

export function AdjustForm({ products, defaultProductId }: AdjustFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <SectionCard title="Adjust stock">
      <form
        action={(formData) => {
          startTransition(async () => {
            const result = await saveInventoryAdjustment(formData);
            if (result.error) {
              alert(result.error);
              return;
            }
            const productId = String(formData.get("productId") ?? "");
            router.push(productId ? `/inventory/${productId}` : "/inventory");
            router.refresh();
          });
        }}
        className="grid max-w-lg gap-4"
      >
        <div>
          <label htmlFor="productId" className="text-xs font-medium text-slate-700">
            Product
          </label>
          <select
            id="productId"
            name="productId"
            required
            defaultValue={defaultProductId ?? ""}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
          >
            <option value="">Select product…</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.productCode} — {product.name} ({product.currentStockQuantity}{" "}
                {product.unit})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="quantityChange"
            className="text-xs font-medium text-slate-700"
          >
            Quantity change
          </label>
          <input
            id="quantityChange"
            name="quantityChange"
            type="number"
            step="any"
            required
            placeholder="Use negative to deduct"
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Positive adds stock; negative removes stock.
          </p>
        </div>
        <div>
          <label
            htmlFor="transactionDate"
            className="text-xs font-medium text-slate-700"
          >
            Date
          </label>
          <input
            id="transactionDate"
            name="transactionDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label htmlFor="enteredBy" className="text-xs font-medium text-slate-700">
            Entered by
          </label>
          <input
            id="enteredBy"
            name="enteredBy"
            type="text"
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label htmlFor="notes" className="text-xs font-medium text-slate-700">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          Save adjustment
        </button>
      </form>
    </SectionCard>
  );
}
