"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type ProductType,
  productInputClassName,
  productStatusFormOptions,
  productTypeFormOptions,
  productTypeHelperText,
  productUnitFormOptions,
} from "@/components/products/product-utils";
import {
  type DrainRingStyle,
  getDrainRingStyleOptionsForDiameter,
} from "@/lib/drain-ring-utils";
import {
  getCategoryNames,
  getSubcategoriesForCategory,
  mergeCatalogWithInUseValues,
  type ProductCatalogCategory,
} from "@/lib/product-catalog-settings";

export type ProductFormValues = {
  productCode?: string;
  productName?: string;
  productType?: ProductType;
  category?: string;
  subcategory?: string;
  unit?: string;
  status?: string;
  defaultPrice?: string;
  weight?: string;
  yards?: string;
  trackInventory?: "yes" | "no";
  currentStockQuantity?: string;
  reorderLevel?: string;
  isDrainRing?: "yes" | "no";
  heightFeet?: string;
  ringDiameterFeet?: string;
  drainRingStyle?: DrainRingStyle;
  isCasting?: "yes" | "no";
  castingHeightFeet?: string;
  castingClearOpeningInches?: string;
  notes?: string;
};

const drainRingDiameterOptions = ["4", "6", "8", "10", "12"];

type ProductFormProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  submitLabel: string;
  catalog: ProductCatalogCategory[];
  defaultValues?: ProductFormValues;
};

export function ProductForm({
  action,
  cancelHref,
  submitLabel,
  catalog,
  defaultValues,
}: ProductFormProps) {
  const mergedCatalog = useMemo(
    () =>
      mergeCatalogWithInUseValues(catalog, [
        {
          category: defaultValues?.category ?? "",
          subcategory: defaultValues?.subcategory ?? "",
        },
      ]),
    [catalog, defaultValues?.category, defaultValues?.subcategory],
  );
  const categoryNames = getCategoryNames(mergedCatalog);
  const initialCategory =
    defaultValues?.category && categoryNames.includes(defaultValues.category)
      ? defaultValues.category
      : (categoryNames[0] ?? "Vaults");
  const initialSubcategories = getSubcategoriesForCategory(
    mergedCatalog,
    initialCategory,
  );
  const initialSubcategory =
    defaultValues?.subcategory &&
    initialSubcategories.includes(defaultValues.subcategory)
      ? defaultValues.subcategory
      : (initialSubcategories[0] ?? "");

  const [productType, setProductType] = useState<ProductType>(
    defaultValues?.productType ?? "STOCK",
  );
  const [category, setCategory] = useState(initialCategory);
  const [subcategory, setSubcategory] = useState(initialSubcategory);
  const [isDrainRing, setIsDrainRing] = useState(
    defaultValues?.isDrainRing === "yes",
  );
  const [isCasting, setIsCasting] = useState(
    defaultValues?.isCasting === "yes",
  );
  const [ringDiameterFeet, setRingDiameterFeet] = useState(
    defaultValues?.ringDiameterFeet ?? "10",
  );
  const [drainRingStyle, setDrainRingStyle] = useState<DrainRingStyle>(
    defaultValues?.drainRingStyle ?? "DRAIN",
  );
  const drainRingStyleOptions = getDrainRingStyleOptionsForDiameter(
    Number(ringDiameterFeet),
  );
  const subcategoryOptions = getSubcategoriesForCategory(mergedCatalog, category);

  function handleRingDiameterChange(nextDiameter: string) {
    setRingDiameterFeet(nextDiameter);
    const nextOptions = getDrainRingStyleOptionsForDiameter(Number(nextDiameter));
    if (!nextOptions.some((option) => option.value === drainRingStyle)) {
      setDrainRingStyle("DRAIN");
    }
  }

  function handleCategoryChange(nextCategory: string) {
    setCategory(nextCategory);
    const nextSubcategories = getSubcategoriesForCategory(
      mergedCatalog,
      nextCategory,
    );
    setSubcategory((current) =>
      nextSubcategories.includes(current)
        ? current
        : (nextSubcategories[0] ?? ""),
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div>
        <label
          htmlFor="productType"
          className="block text-xs font-medium text-slate-700"
        >
          Product Type *
        </label>
        <select
          id="productType"
          name="productType"
          required
          value={productType}
          onChange={(event) =>
            setProductType(event.target.value as ProductType)
          }
          className={productInputClassName}
        >
          {productTypeFormOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {productTypeHelperText[productType]}
        </p>
      </div>

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
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value)}
            className={productInputClassName}
          >
            {categoryNames.map((option) => (
              <option key={option} value={option}>
                {option}
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
            value={subcategory}
            onChange={(event) => setSubcategory(event.target.value)}
            className={productInputClassName}
          >
            {subcategoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
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
            defaultValue={defaultValues?.unit ?? "EA"}
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
            htmlFor="status"
            className="block text-xs font-medium text-slate-700"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaultValues?.status ?? "ACTIVE"}
            className={productInputClassName}
          >
            {productStatusFormOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
          type="number"
          min="0"
          step="0.01"
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
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultValues?.weight ?? ""}
            placeholder="8400"
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
            type="number"
            min="0"
            step="0.0001"
            defaultValue={defaultValues?.yards ?? ""}
            placeholder="2.4"
            className={productInputClassName}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
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
            htmlFor="currentStockQuantity"
            className="block text-xs font-medium text-slate-700"
          >
            Current Stock Quantity
          </label>
          <input
            id="currentStockQuantity"
            name="currentStockQuantity"
            type="number"
            min="0"
            step="1"
            defaultValue={defaultValues?.currentStockQuantity ?? "0"}
            className={productInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="reorderLevel"
            className="block text-xs font-medium text-slate-700"
          >
            Reorder Level
          </label>
          <input
            id="reorderLevel"
            name="reorderLevel"
            type="number"
            min="0"
            step="1"
            defaultValue={defaultValues?.reorderLevel ?? "0"}
            className={productInputClassName}
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div>
          <label
            htmlFor="isDrainRing"
            className="block text-xs font-medium text-slate-700"
          >
            Ring
          </label>
          <select
            id="isDrainRing"
            name="isDrainRing"
            value={isDrainRing ? "yes" : "no"}
            onChange={(event) => setIsDrainRing(event.target.value === "yes")}
            className={productInputClassName}
          >
            <option value="no">No</option>
            <option value="yes">Yes — stocked ring SKU</option>
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Rings are quoted by total pool height (linear feet) but stocked and
            shipped as individual rings. Set the ring height and pool diameter
            so deliveries can credit feet back to the quote.
          </p>
        </div>

        {isDrainRing ? (
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ringDiameterFeet"
                className="block text-xs font-medium text-slate-700"
              >
                Pool Diameter (ft)
              </label>
              <select
                id="ringDiameterFeet"
                name="ringDiameterFeet"
                value={ringDiameterFeet}
                onChange={(event) => handleRingDiameterChange(event.target.value)}
                className={productInputClassName}
              >
                {drainRingDiameterOptions.map((diameter) => (
                  <option key={diameter} value={diameter}>
                    {diameter}'
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="drainRingStyle"
                className="block text-xs font-medium text-slate-700"
              >
                Style
              </label>
              <select
                id="drainRingStyle"
                name="drainRingStyle"
                value={drainRingStyle}
                onChange={(event) =>
                  setDrainRingStyle(event.target.value as DrainRingStyle)
                }
                className={productInputClassName}
              >
                {drainRingStyleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                Solid is available at all diameters. Sanitary is only available
                for 8&apos; and 10&apos; diameters.
              </p>
            </div>

            <div>
              <label
                htmlFor="heightFeet"
                className="block text-xs font-medium text-slate-700"
              >
                Ring Height (ft)
              </label>
              <input
                id="heightFeet"
                name="heightFeet"
                type="number"
                min="0"
                step="0.5"
                defaultValue={defaultValues?.heightFeet ?? ""}
                placeholder="4"
                className={productInputClassName}
              />
              <p className="mt-2 text-xs text-slate-500">
                Whole-foot heights for most diameters; 8' rings may use 6"
                (0.5') increments.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div>
          <label
            htmlFor="isCasting"
            className="block text-xs font-medium text-slate-700"
          >
            Casting
          </label>
          <select
            id="isCasting"
            name="isCasting"
            value={isCasting ? "yes" : "no"}
            onChange={(event) => setIsCasting(event.target.value === "yes")}
            className={productInputClassName}
          >
            <option value="no">No</option>
            <option value="yes">Yes — frame/cover casting</option>
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Castings are selected on drill sheets and subtracted from the rim by
            their height. Enter the height that is removed from the wall.
          </p>
        </div>

        {isCasting ? (
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="castingHeightFeet"
                className="block text-xs font-medium text-slate-700"
              >
                Casting Height (ft)
              </label>
              <input
                id="castingHeightFeet"
                name="castingHeightFeet"
                type="number"
                min="0"
                step="0.01"
                defaultValue={defaultValues?.castingHeightFeet ?? ""}
                placeholder="0.67"
                className={productInputClassName}
              />
              <p className="mt-2 text-xs text-slate-500">
                Decimal feet (e.g. 0.67 for an 8&quot; frame).
              </p>
            </div>

            <div>
              <label
                htmlFor="castingClearOpeningInches"
                className="block text-xs font-medium text-slate-700"
              >
                Clear Opening (in)
              </label>
              <input
                id="castingClearOpeningInches"
                name="castingClearOpeningInches"
                type="number"
                min="0"
                step="0.01"
                defaultValue={defaultValues?.castingClearOpeningInches ?? ""}
                placeholder="24"
                className={productInputClassName}
              />
            </div>
          </div>
        ) : null}
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
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
