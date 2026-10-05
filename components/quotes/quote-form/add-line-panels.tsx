"use client";

import { QuoteFormTypeahead } from "@/components/quotes/quote-form-typeahead";
import {
  StockProductPicker,
  type StagedStockProduct,
} from "@/components/quotes/stock-product-picker";
import {
  type QuoteFormProductOption,
  type QuoteFormServiceOption,
  quoteInputClassName,
} from "@/components/quotes/quote-utils";
import type { ProductTaxonomyCategory } from "@/lib/product-taxonomy";

/** Body of the add-line modal for "Stock Product" (category browser). */
export function AddStockProductPanel({
  taxonomy,
  priceListId,
  onAdd,
  onCancel,
}: {
  taxonomy: ProductTaxonomyCategory[];
  priceListId: string | null;
  onAdd: (items: StagedStockProduct[]) => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="border-b border-slate-100 px-4 py-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Add Stock Structures
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Browse by category, set quantities on everything you need
          — across categories too — then add them all at once.
        </p>
      </div>
      <StockProductPicker
        taxonomy={taxonomy}
        priceListId={priceListId}
        onAdd={onAdd}
        onCancel={onCancel}
      />
    </>
  );
}

/** Body of the add-line modal for "Configurable Structure" (template-based). */
export function AddConfigurableStructurePanel({
  selectedConfigurableProduct,
  searchConfigurableProducts,
  onProductChange,
  structureNumber,
  onStructureNumberChange,
  structureQty,
  onStructureQtyChange,
  structureDescription,
  onStructureDescriptionChange,
  structureUnitPrice,
  onStructureUnitPriceChange,
  structureWeight,
  onStructureWeightChange,
  structureYards,
  onStructureYardsChange,
  onCancel,
  onAdd,
}: {
  selectedConfigurableProduct: QuoteFormProductOption | null;
  searchConfigurableProducts: (
    query: string,
  ) => Promise<QuoteFormProductOption[]>;
  onProductChange: (product: QuoteFormProductOption | null) => void;
  structureNumber: string;
  onStructureNumberChange: (value: string) => void;
  structureQty: string;
  onStructureQtyChange: (value: string) => void;
  structureDescription: string;
  onStructureDescriptionChange: (value: string) => void;
  structureUnitPrice: string;
  onStructureUnitPriceChange: (value: string) => void;
  structureWeight: string;
  onStructureWeightChange: (value: string) => void;
  structureYards: string;
  onStructureYardsChange: (value: string) => void;
  onCancel: () => void;
  onAdd: () => void;
}) {
  return (
    <>
      <h3 className="text-sm font-semibold text-slate-900">
        Add Configurable Structure
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Based on a product template with job-specific details.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-700">
            Product Template
          </label>
          <QuoteFormTypeahead
            selectedLabel={
              selectedConfigurableProduct
                ? `${selectedConfigurableProduct.code} — ${selectedConfigurableProduct.description}`
                : ""
            }
            placeholder="Search by product code or name"
            searchItems={searchConfigurableProducts}
            itemKey={(product) => product.id}
            itemLabel={(product) =>
              `${product.code} — ${product.description}`
            }
            onSelect={onProductChange}
            emptyLabel="No active configurable products match. Add products in the Products module first."
            inputClassName={quoteInputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Structure Number
          </label>
          <input
            type="text"
            value={structureNumber}
            onChange={(event) => {
              onStructureNumberChange(event.target.value);
              if (selectedConfigurableProduct) {
                onStructureDescriptionChange(
                  `${selectedConfigurableProduct.description} ${event.target.value}`.trim(),
                );
              }
            }}
            className={quoteInputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Quantity
          </label>
          <input
            type="text"
            value={structureQty}
            onChange={(event) => onStructureQtyChange(event.target.value)}
            className={quoteInputClassName}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-700">
            Description
          </label>
          <input
            type="text"
            value={structureDescription}
            onChange={(event) =>
              onStructureDescriptionChange(event.target.value)
            }
            className={quoteInputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Unit Price
          </label>
          <input
            type="text"
            value={structureUnitPrice}
            onChange={(event) =>
              onStructureUnitPriceChange(event.target.value)
            }
            placeholder="14250"
            className={quoteInputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Weight (lb)
          </label>
          <input
            type="text"
            value={structureWeight}
            onChange={(event) => onStructureWeightChange(event.target.value)}
            placeholder="18200"
            className={quoteInputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Yards
          </label>
          <input
            type="text"
            value={structureYards}
            onChange={(event) => onStructureYardsChange(event.target.value)}
            placeholder="5.8"
            className={quoteInputClassName}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={!selectedConfigurableProduct}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add to Quote
        </button>
      </div>
    </>
  );
}

/** Body of the add-line modal for "Service / Misc" charges. */
export function AddServicePanel({
  serviceOptions,
  selectedServiceItem,
  onServiceOptionChange,
  serviceDescription,
  onServiceDescriptionChange,
  serviceQty,
  onServiceQtyChange,
  serviceUnit,
  onServiceUnitChange,
  serviceUnitPrice,
  onServiceUnitPriceChange,
  serviceTaxable,
  onServiceTaxableChange,
  onCancel,
  onAdd,
}: {
  serviceOptions: QuoteFormServiceOption[];
  selectedServiceItem: string;
  onServiceOptionChange: (item: string) => void;
  serviceDescription: string;
  onServiceDescriptionChange: (value: string) => void;
  serviceQty: string;
  onServiceQtyChange: (value: string) => void;
  serviceUnit: string;
  onServiceUnitChange: (value: string) => void;
  serviceUnitPrice: string;
  onServiceUnitPriceChange: (value: string) => void;
  serviceTaxable: boolean;
  onServiceTaxableChange: (value: boolean) => void;
  onCancel: () => void;
  onAdd: () => void;
}) {
  return (
    <>
      <h3 className="text-sm font-semibold text-slate-900">
        Add Service / Misc Item
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Non-inventory service or miscellaneous charge.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-700">
            Service
          </label>
          <select
            value={selectedServiceItem}
            onChange={(event) =>
              onServiceOptionChange(event.target.value)
            }
            className={quoteInputClassName}
          >
            {serviceOptions.map((service) => (
              <option key={service.item} value={service.item}>
                {service.item}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-700">
            Description
          </label>
          <input
            type="text"
            value={serviceDescription}
            onChange={(event) =>
              onServiceDescriptionChange(event.target.value)
            }
            className={quoteInputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Quantity
          </label>
          <input
            type="text"
            value={serviceQty}
            onChange={(event) => onServiceQtyChange(event.target.value)}
            className={quoteInputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Unit
          </label>
          <input
            type="text"
            value={serviceUnit}
            onChange={(event) => onServiceUnitChange(event.target.value)}
            className={quoteInputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Unit Price
          </label>
          <input
            type="text"
            value={serviceUnitPrice}
            onChange={(event) =>
              onServiceUnitPriceChange(event.target.value)
            }
            className={quoteInputClassName}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Taxable
          </label>
          <select
            value={serviceTaxable ? "yes" : "no"}
            onChange={(event) =>
              onServiceTaxableChange(event.target.value === "yes")
            }
            className={quoteInputClassName}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Add to Quote
        </button>
      </div>
    </>
  );
}
