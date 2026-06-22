"use client";

import {
  countProductsForRename,
  formatCatalogRenameLabel,
  type ProductCatalogRename,
  type ProductCatalogUsageGroup,
} from "@/lib/product-catalog-settings";

type ProductCatalogRenameConfirmDialogProps = {
  renames: ProductCatalogRename[];
  usage: ProductCatalogUsageGroup[];
  onCancel: () => void;
  onConfirm: () => void;
};

export function ProductCatalogRenameConfirmDialog({
  renames,
  usage,
  onCancel,
  onConfirm,
}: ProductCatalogRenameConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-rename-dialog-title"
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h3
          id="catalog-rename-dialog-title"
          className="text-sm font-semibold text-slate-900"
        >
          Update existing products?
        </h3>
        <p className="mt-2 text-xs text-slate-600">
          These catalog renames will update matching products before saving
          settings.
        </p>

        <ul className="mt-4 space-y-3">
          {renames.map((rename, index) => {
            const productCount = countProductsForRename(rename, usage);
            const countLabel =
              productCount === 1 ? "1 product" : `${productCount} products`;

            return (
              <li
                key={`${formatCatalogRenameLabel(rename)}-${index}`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
              >
                <p className="font-medium text-slate-900">
                  {formatCatalogRenameLabel(rename)}
                </p>
                <p className="mt-1 text-slate-600">
                  {productCount > 0
                    ? `Affects ${countLabel}.`
                    : "No matching products."}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Update products and save
          </button>
        </div>
      </div>
    </div>
  );
}
