"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteProductCategory,
  deleteProductSubcategory,
} from "@/app/settings/products/actions";
import { useConfirm } from "@/components/ui/confirm-dialog";

type DeleteProductCategoryButtonProps = {
  categoryId: string;
  categoryName: string;
  productCount: number;
  subcategoryCount: number;
};

export function DeleteProductCategoryButton({
  categoryId,
  categoryName,
  productCount,
  subcategoryCount,
}: DeleteProductCategoryButtonProps) {
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const blockedReason =
    productCount > 0
      ? `${productCount} product${productCount === 1 ? "" : "s"} assigned`
      : subcategoryCount > 0
        ? `${subcategoryCount} subcategor${subcategoryCount === 1 ? "y" : "ies"} remain`
        : null;

  async function handleDelete() {
    if (blockedReason) {
      return;
    }

    const confirmed = await confirm({
      title: "Delete category?",
      message: `Delete "${categoryName}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    formData.set("id", categoryId);

    startTransition(async () => {
      setError(null);
      const result = await deleteProductCategory(formData);
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending || Boolean(blockedReason)}
        title={blockedReason ?? undefined}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Delete category"}
      </button>
      {blockedReason ? (
        <p className="mt-1 text-[11px] text-slate-500">
          Cannot delete while {blockedReason}.
        </p>
      ) : null}
      {error ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}
    </div>
  );
}

type DeleteProductSubcategoryButtonProps = {
  subcategoryId: string;
  subcategoryName: string;
  categoryName: string;
  productCount: number;
};

export function DeleteProductSubcategoryButton({
  subcategoryId,
  subcategoryName,
  categoryName,
  productCount,
}: DeleteProductSubcategoryButtonProps) {
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    const productWarning =
      productCount > 0
        ? ` ${productCount} product${productCount === 1 ? "" : "s"} will keep category "${categoryName}" but lose this subcategory assignment.`
        : "";

    const confirmed = await confirm({
      title: "Delete subcategory?",
      message: `Delete "${subcategoryName}" under "${categoryName}"?${productWarning} This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    formData.set("id", subcategoryId);

    startTransition(async () => {
      setError(null);
      const result = await deleteProductSubcategory(formData);
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
      {error ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}
    </div>
  );
}
