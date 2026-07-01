"use client";

import { useState, useTransition } from "react";
import { deleteCustomer } from "@/app/customers/actions";

type DeleteCustomerButtonProps = {
  customerId: string;
  customerName: string;
};

export function DeleteCustomerButton({
  customerId,
  customerName,
}: DeleteCustomerButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${customerName}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    formData.set("id", customerId);

    startTransition(async () => {
      setError(null);
      const result = await deleteCustomer(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
      {error ? (
        <p className="mt-2 max-w-xs text-xs text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
