"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveInventoryAdjustment, searchInventoryProducts } from "@/app/inventory/actions";
import { FormTypeahead } from "@/components/common/form-typeahead";
import { SectionCard } from "@/components/dashboard/section-card";
import { SubmitButton } from "@/components/ui/submit-button";

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
  const [submissionKey] = useState(() => crypto.randomUUID());
  const initialProduct =
    products.find((product) => product.id === defaultProductId) ?? null;
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [productLabel, setProductLabel] = useState(
    initialProduct
      ? `${initialProduct.productCode} — ${initialProduct.name} (${initialProduct.currentStockQuantity} ${initialProduct.unit})`
      : "",
  );

  return (
    <SectionCard title="Adjust stock">
      <form
        action={(formData) => {
          startTransition(async () => {
            formData.set("submissionKey", submissionKey);
            formData.set("productId", productId);
            const result = await saveInventoryAdjustment(formData);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Stock adjustment saved.");
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
          <FormTypeahead
            inputId="productId"
            selectedLabel={productLabel}
            placeholder="Search products…"
            initialItems={initialProduct ? [initialProduct] : products.slice(0, 20)}
            searchItems={searchInventoryProducts}
            itemKey={(product) => product.id}
            itemLabel={(product) =>
              `${product.productCode} — ${product.name} (${product.currentStockQuantity} ${product.unit})`
            }
            onSelect={(product) => {
              setProductId(product?.id ?? "");
              setProductLabel(
                product
                  ? `${product.productCode} — ${product.name} (${product.currentStockQuantity} ${product.unit})`
                  : "",
              );
            }}
            inputClassName="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
            preventEnterSubmit={false}
          />
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
        <SubmitButton disabled={pending || !productId} pendingLabel="Saving…">
          Save adjustment
        </SubmitButton>
      </form>
    </SectionCard>
  );
}
