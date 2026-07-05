"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteCustomer } from "@/app/customers/actions";
import { useConfirm } from "@/components/ui/confirm-dialog";

type DeleteCustomerButtonProps = {
  customerId: string;
  customerName: string;
};

export function DeleteCustomerButton({
  customerId,
  customerName,
}: DeleteCustomerButtonProps) {
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    const confirmed = await confirm({
      title: "Delete customer?",
      message: `Delete "${customerName}"? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
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
        toast.error(result.error);
      } else {
        toast.success("Customer deleted.");
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
