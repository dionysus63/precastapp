"use client";

import { deleteCustomer } from "@/app/customers/actions";

type DeleteCustomerButtonProps = {
  customerId: string;
  customerName: string;
};

export function DeleteCustomerButton({
  customerId,
  customerName,
}: DeleteCustomerButtonProps) {
  return (
    <form
      action={deleteCustomer}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Delete "${customerName}"? This cannot be undone.`,
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={customerId} />
      <button
        type="submit"
        className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
      >
        Delete
      </button>
    </form>
  );
}
