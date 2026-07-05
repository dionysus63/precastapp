import Link from "next/link";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SettingsFeedback } from "@/components/settings/settings-form-fields";
import { SettingsShell } from "@/components/settings/settings-shell";
import {
  createProductCategoryFormAction,
  createProductSubcategoryFormAction,
  updateProductCategoryFormAction,
  updateProductSubcategoryFormAction,
} from "@/app/settings/products/actions";
import {
  DeleteProductCategoryButton,
  DeleteProductSubcategoryButton,
} from "@/components/settings/delete-taxonomy-button";
import { listAllProductTaxonomyForSettings } from "@/lib/product-taxonomy.server";
import { productKindFormOptionsForCategoryDefault } from "@/lib/product-taxonomy";
import { productKindLabels } from "@/lib/product-kinds";
import {
  catalogProductTypeFormOptions,
  productTypeLabels,
} from "@/lib/product-types";

type ProductCatalogSettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

export default async function ProductCatalogSettingsPage({
  searchParams,
}: ProductCatalogSettingsPageProps) {
  const params = await searchParams;
  const categories = await listAllProductTaxonomyForSettings();

  const inputClass =
    "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

  return (
    <SettingsShell
      title="Product Catalog"
      subtitle="Database-backed categories and subcategories for all products."
    >
      <SettingsFeedback
        error={params.error ? decodeURIComponent(params.error) : null}
        success={params.success ? "Changes saved." : null}
      />

      <SectionCard title="Categories" noPadding>
        {categories.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No categories yet. Add your first category below.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Product Type</th>
                  <th className="px-4 py-2.5 font-semibold">Default Kind</th>
                  <th className="px-4 py-2.5 font-semibold">Products</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Sort</th>
                  <th className="px-4 py-2.5 font-semibold">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((category) => (
                  <tr key={category.id} className="align-top hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {category.name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {productTypeLabels[category.productType]}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {category.defaultProductKind
                        ? productKindLabels[category.defaultProductKind]
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {category._count.products}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={category.status === "ACTIVE" ? "Active" : "Inactive"}
                        variant={
                          category.status === "ACTIVE" ? "success" : "neutral"
                        }
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {category.sortOrder}
                    </td>
                    <td className="px-4 py-2.5">
                      <details>
                        <summary className="cursor-pointer text-slate-700 underline hover:text-slate-900">
                          Edit
                        </summary>
                        <div className="mt-3 min-w-[320px] space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <form action={updateProductCategoryFormAction} className="grid gap-2">
                            <input type="hidden" name="id" value={category.id} />
                            <div>
                              <label className="text-[11px] font-medium text-slate-600">
                                Name
                              </label>
                              <input
                                name="name"
                                defaultValue={category.name}
                                required
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-slate-600">
                                Product type
                              </label>
                              <select
                                name="productType"
                                defaultValue={category.productType}
                                required
                                className={inputClass}
                              >
                                {catalogProductTypeFormOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[11px] font-medium text-slate-600">
                                Default product kind
                              </label>
                              <select
                                name="defaultProductKind"
                                defaultValue={category.defaultProductKind ?? ""}
                                className={inputClass}
                              >
                                {productKindFormOptionsForCategoryDefault.map(
                                  (option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[11px] font-medium text-slate-600">
                                  Status
                                </label>
                                <select
                                  name="status"
                                  defaultValue={category.status}
                                  className={inputClass}
                                >
                                  <option value="ACTIVE">Active</option>
                                  <option value="INACTIVE">Inactive</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[11px] font-medium text-slate-600">
                                  Sort
                                </label>
                                <input
                                  name="sortOrder"
                                  type="number"
                                  defaultValue={category.sortOrder}
                                  className={inputClass}
                                />
                              </div>
                            </div>
                            <button
                              type="submit"
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              Save category
                            </button>
                          </form>

                          <DeleteProductCategoryButton
                            categoryId={category.id}
                            categoryName={category.name}
                            productCount={category._count.products}
                            subcategoryCount={category.subcategories.length}
                          />

                          <div className="border-t border-slate-200 pt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Subcategories
                            </p>
                            {category.subcategories.length === 0 ? (
                              <p className="mt-2 text-xs text-slate-500">
                                No subcategories yet.
                              </p>
                            ) : (
                              <ul className="mt-2 space-y-2">
                                {category.subcategories.map((subcategory) => (
                                  <li
                                    key={subcategory.id}
                                    className="rounded-md border border-slate-200 bg-white p-2"
                                  >
                                    <form
                                      action={updateProductSubcategoryFormAction}
                                      className="grid gap-2"
                                    >
                                      <input
                                        type="hidden"
                                        name="id"
                                        value={subcategory.id}
                                      />
                                      <div className="flex items-center justify-between gap-2">
                                        <input
                                          name="name"
                                          defaultValue={subcategory.name}
                                          required
                                          className={inputClass}
                                        />
                                        <span className="shrink-0 text-[11px] text-slate-500">
                                          {subcategory._count.products} products
                                        </span>
                                      </div>
                                      <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                          <label className="text-[11px] font-medium text-slate-600">
                                            Sort
                                          </label>
                                          <input
                                            name="sortOrder"
                                            type="number"
                                            defaultValue={subcategory.sortOrder}
                                            className={inputClass}
                                          />
                                        </div>
                                        <button
                                          type="submit"
                                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                          Save
                                        </button>
                                        <DeleteProductSubcategoryButton
                                          subcategoryId={subcategory.id}
                                          subcategoryName={subcategory.name}
                                          categoryName={category.name}
                                          productCount={subcategory._count.products}
                                        />
                                      </div>
                                    </form>
                                  </li>
                                ))}
                              </ul>
                            )}

                            <form
                              action={createProductSubcategoryFormAction}
                              className="mt-3 grid gap-2 border-t border-slate-200 pt-3"
                            >
                              <input
                                type="hidden"
                                name="categoryId"
                                value={category.id}
                              />
                              <p className="text-xs font-medium text-slate-700">
                                Add subcategory
                              </p>
                              <input
                                name="name"
                                placeholder="Subcategory name"
                                required
                                className={inputClass}
                              />
                              <input
                                name="sortOrder"
                                type="number"
                                defaultValue="0"
                                className={inputClass}
                              />
                              <button
                                type="submit"
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                              >
                                Add subcategory
                              </button>
                            </form>
                          </div>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Add category">
        <form action={createProductCategoryFormAction} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="text-xs font-medium text-slate-700">
              Name *
            </label>
            <input id="name" name="name" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="productType" className="text-xs font-medium text-slate-700">
              Product type *
            </label>
            <select id="productType" name="productType" required className={inputClass}>
              {catalogProductTypeFormOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="defaultProductKind"
              className="text-xs font-medium text-slate-700"
            >
              Default product kind
            </label>
            <select
              id="defaultProductKind"
              name="defaultProductKind"
              className={inputClass}
            >
              {productKindFormOptionsForCategoryDefault.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sortOrder" className="text-xs font-medium text-slate-700">
              Sort order
            </label>
            <input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue="0"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Add Category
            </button>
          </div>
        </form>
      </SectionCard>

      <Link
        href="/settings"
        className="inline-block text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Settings
      </Link>
    </SettingsShell>
  );
}
