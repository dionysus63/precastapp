"use client";

import { useMemo, useState } from "react";
import { addProductGroupMembersFormAction } from "@/app/settings/product-groups/actions";

type PickerProduct = { id: string; productCode: string; name: string };

/**
 * Multi-select product picker for a group: click products to highlight them
 * (green), then add every selected one in a single submit. Products already
 * in the group are shown grayed with an "In group" badge.
 */
export function GroupProductPicker({
  groupId,
  products,
  memberProductIds,
}: {
  groupId: string;
  products: PickerProduct[];
  memberProductIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const memberSet = useMemo(
    () => new Set(memberProductIds),
    [memberProductIds],
  );

  const trimmed = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!trimmed) {
      return products;
    }
    return products.filter((product) =>
      `${product.productCode} ${product.name}`.toLowerCase().includes(trimmed),
    );
  }, [products, trimmed]);

  function toggle(productId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  async function submitSelected(formData: FormData) {
    await addProductGroupMembersFormAction(formData);
    setSelected(new Set());
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={`group-search-${groupId}`}
          className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
        >
          Click products to select, then add
        </label>
        <form action={submitSelected}>
          <input type="hidden" name="groupId" value={groupId} />
          {[...selected].map((productId) => (
            <input
              key={productId}
              type="hidden"
              name="productIds"
              value={productId}
            />
          ))}
          <button
            type="submit"
            disabled={selected.size === 0}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {selected.size > 0
              ? `Add ${selected.size} selected`
              : "Add selected"}
          </button>
        </form>
      </div>
      <input
        id={`group-search-${groupId}`}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by code or name…"
        className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
      />
      {visible.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">No products match.</p>
      ) : (
        <ul className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {visible.map((product) => {
            const isMember = memberSet.has(product.id);
            const isSelected = selected.has(product.id);
            return (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={isMember}
                  aria-pressed={isSelected}
                  onClick={() => toggle(product.id)}
                  title={product.name}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs ${
                    isMember
                      ? "cursor-default bg-slate-50 text-slate-400"
                      : isSelected
                        ? "bg-emerald-100/80 hover:bg-emerald-100"
                        : "hover:bg-slate-50"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span
                      className={`font-medium ${
                        isMember ? "text-slate-400" : "text-slate-900"
                      }`}
                    >
                      {product.productCode}
                    </span>
                    <span className="ml-1.5">{product.name}</span>
                  </span>
                  {isMember ? (
                    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      In group
                    </span>
                  ) : isSelected ? (
                    <span className="shrink-0 rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
                      Selected
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
