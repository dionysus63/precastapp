import Link from "next/link";
import {
  productCategoryFormOptions,
  productInputClassName,
  productSubcategoryFormOptions,
  productUnitFormOptions,
} from "@/components/products/product-utils";

export type ProductFormValues = {
  id?: string;
  productCode: string;
  productName: string;
  category: string;
  subcategory: string;
  unit: string;
  defaultPrice: string;
  weight: string;
  yards: string;
  trackInventory: "yes" | "no";
  notes: string;
};

type ProductFormProps = {
  cancelHref: string;
  submitLabel: string;
  defaultValues?: ProductFormValues;
};

export function ProductForm({
  cancelHref,
  submitLabel,
  defaultValues,
}: ProductFormProps) {
  return (
    <form className="space-y-5">
      {defaultValues?.id ? (
        <input type="hidden" name="id" value={defaultValues.id} />
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="productCode"
            className="block text-xs font-medium text-slate-700"
          >
            Product Code *
          </label>
          <input
            id="productCode"
            name="productCode"
            type="text"
            required
            defaultValue={defaultValues?.productCode ?? ""}
            placeholder="VLT-48x72"
            className={productInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="productName"
            className="block text-xs font-medium text-slate-700"
          >
            Product Name *
          </label>
          <input
            id="productName"
            name="productName"
            type="text"
            required
            defaultValue={defaultValues?.productName ?? ""}
            placeholder="48x72 Utility Vault"
            className={productInputClassName}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="category"
            className="block text-xs font-medium text-slate-700"
          >
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={defaultValues?.category ?? "Vaults"}
            className={productInputClassName}
          >
            {productCategoryFormOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="subcategory"
            className="block text-xs font-medium text-slate-700"
          >
            Subcategory
          </label>
          <select
            id="subcategory"
            name="subcategory"
            defaultValue={defaultValues?.subcategory ?? "Traffic Rated"}
            className={productInputClassName}
          >
            {productSubcategoryFormOptions.map((subcategory) => (
              <option key={subcategory} value={subcategory}>
                {subcategory}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="unit"
          className="block text-xs font-medium text-slate-700"
        >
          Unit
        </label>
        <select
          id="unit"
          name="unit"
          defaultValue={defaultValues?.unit ?? "Each"}
          className={productInputClassName}
        >
          {productUnitFormOptions.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="defaultPrice"
          className="block text-xs font-medium text-slate-700"
        >
          Default Price
        </label>
        <input
          id="defaultPrice"
          name="defaultPrice"
          type="text"
          defaultValue={defaultValues?.defaultPrice ?? ""}
          placeholder="4850.00"
          className={productInputClassName}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="weight"
            className="block text-xs font-medium text-slate-700"
          >
            Weight
          </label>
          <input
            id="weight"
            name="weight"
            type="text"
            defaultValue={defaultValues?.weight ?? ""}
            placeholder="8400 lb"
            className={productInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="yards"
            className="block text-xs font-medium text-slate-700"
          >
            Yards
          </label>
          <input
            id="yards"
            name="yards"
            type="text"
            defaultValue={defaultValues?.yards ?? ""}
            placeholder="2.4"
            className={productInputClassName}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="trackInventory"
          className="block text-xs font-medium text-slate-700"
        >
          Track Inventory
        </label>
        <select
          id="trackInventory"
          name="trackInventory"
          defaultValue={defaultValues?.trackInventory ?? "yes"}
          className={productInputClassName}
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-xs font-medium text-slate-700"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={defaultValues?.notes ?? ""}
          placeholder="Production notes, lead time, or quoting guidance..."
          className={productInputClassName}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
        <Link
          href={cancelHref}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
