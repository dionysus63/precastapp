"use client";

import { useEffect, useRef, useState } from "react";
import { ProductCatalogRenameConfirmDialog } from "@/components/settings/product-catalog-rename-confirm-dialog";
import {
  settingsInputClassName,
  settingsSubmitClassName,
  settingsTextareaClassName,
} from "@/components/settings/settings-form-fields";
import {
  detectCatalogRenames,
  renamesAffectingProducts,
  type ProductCatalogCategory,
  type ProductCatalogRename,
  type ProductCatalogUsageGroup,
} from "@/lib/product-catalog-settings";

type EditableCategory = {
  id: string;
  originalName: string;
  originalSubcategories: string[];
  name: string;
  subcategoriesText: string;
};

type ProductCatalogSettingsFormProps = {
  initialCatalog: ProductCatalogCategory[];
  usage: ProductCatalogUsageGroup[];
  action: (formData: FormData) => Promise<void>;
};

function createCategoryId() {
  return `category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toEditableCategories(
  catalog: ProductCatalogCategory[],
): EditableCategory[] {
  return catalog.map((category) => ({
    id: createCategoryId(),
    originalName: category.name,
    originalSubcategories: [...category.subcategories],
    name: category.name,
    subcategoriesText: category.subcategories.join("\n"),
  }));
}

function parseSubcategoriesText(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function toEditableBlocks(categories: EditableCategory[]) {
  return categories.map((category) => ({
    originalName: category.originalName,
    originalSubcategories: category.originalSubcategories,
    name: category.name.trim(),
    subcategories: parseSubcategoriesText(category.subcategoriesText),
  }));
}

export function ProductCatalogSettingsForm({
  initialCatalog,
  usage,
  action,
}: ProductCatalogSettingsFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const skipInterceptRef = useRef(false);
  const [categories, setCategories] = useState<EditableCategory[]>(() =>
    toEditableCategories(initialCatalog),
  );
  const [pendingRenames, setPendingRenames] = useState<ProductCatalogRename[]>(
    [],
  );
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [catalogRenamesJson, setCatalogRenamesJson] = useState("");
  const [confirmCatalogRenames, setConfirmCatalogRenames] = useState("");
  const [shouldSubmit, setShouldSubmit] = useState(false);

  useEffect(() => {
    if (!shouldSubmit) {
      return;
    }

    setShouldSubmit(false);
    formRef.current?.requestSubmit();
  }, [shouldSubmit, catalogRenamesJson, confirmCatalogRenames]);

  function addCategory() {
    setCategories((current) => [
      ...current,
      {
        id: createCategoryId(),
        originalName: "",
        originalSubcategories: [],
        name: "",
        subcategoriesText: "",
      },
    ]);
  }

  function removeCategory(id: string) {
    setCategories((current) => current.filter((category) => category.id !== id));
  }

  function updateCategory(
    id: string,
    updates: Partial<Pick<EditableCategory, "name" | "subcategoriesText">>,
  ) {
    setCategories((current) =>
      current.map((category) =>
        category.id === id ? { ...category, ...updates } : category,
      ),
    );
  }

  function submitWithRenames(
    renames: ProductCatalogRename[],
    options: { confirmed: boolean },
  ) {
    setCatalogRenamesJson(renames.length > 0 ? JSON.stringify(renames) : "");
    setConfirmCatalogRenames(options.confirmed ? "1" : "");
    skipInterceptRef.current = true;
    setShouldSubmit(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (skipInterceptRef.current) {
      skipInterceptRef.current = false;
      return;
    }

    event.preventDefault();

    const renames = detectCatalogRenames(toEditableBlocks(categories));
    if (renames.length === 0) {
      submitWithRenames([], { confirmed: false });
      return;
    }

    if (!renamesAffectingProducts(renames, usage)) {
      submitWithRenames(renames, { confirmed: false });
      return;
    }

    setPendingRenames(renames);
    setShowRenameDialog(true);
  }

  function handleConfirmRenames() {
    setShowRenameDialog(false);
    submitWithRenames(pendingRenames, { confirmed: true });
  }

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {categories.map((category, index) => (
          <div
            key={category.id}
            className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Category {index + 1}
              </p>
              {categories.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeCategory(category.id)}
                  className="text-[11px] font-medium text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <label
                  htmlFor={`category-name-${category.id}`}
                  className="block text-xs font-medium text-slate-700"
                >
                  Category name
                </label>
                <input
                  id={`category-name-${category.id}`}
                  value={category.name}
                  onChange={(event) =>
                    updateCategory(category.id, { name: event.target.value })
                  }
                  required
                  className={`${settingsInputClassName} mt-1`}
                />
              </div>

              <div>
                <label
                  htmlFor={`category-subcategories-${category.id}`}
                  className="block text-xs font-medium text-slate-700"
                >
                  Subcategories
                </label>
                <p className="mt-1 text-[11px] text-slate-500">
                  One per line. Renames are matched by line position within each
                  category.
                </p>
                <textarea
                  id={`category-subcategories-${category.id}`}
                  value={category.subcategoriesText}
                  onChange={(event) =>
                    updateCategory(category.id, {
                      subcategoriesText: event.target.value,
                    })
                  }
                  rows={4}
                  required
                  className={`${settingsTextareaClassName} mt-1`}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addCategory}
          className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Add category
        </button>

        <input
          type="hidden"
          name="productCatalog"
          value={JSON.stringify(
            categories.map((category) => ({
              name: category.name.trim(),
              subcategories: parseSubcategoriesText(category.subcategoriesText),
            })),
          )}
        />
        <input type="hidden" name="catalogRenames" value={catalogRenamesJson} />
        <input
          type="hidden"
          name="confirmCatalogRenames"
          value={confirmCatalogRenames}
        />

        <button type="submit" className={settingsSubmitClassName}>
          Save
        </button>
      </form>

      {showRenameDialog ? (
        <ProductCatalogRenameConfirmDialog
          renames={pendingRenames}
          usage={usage}
          onCancel={() => {
            setShowRenameDialog(false);
            setPendingRenames([]);
          }}
          onConfirm={handleConfirmRenames}
        />
      ) : null}
    </>
  );
}
