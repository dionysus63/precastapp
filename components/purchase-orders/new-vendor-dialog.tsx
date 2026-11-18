"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createVendorInPlace,
  type CreatedVendor,
} from "@/app/settings/vendors/actions";
import { Button } from "@/components/ui/button";
import { purchaseOrderPrefix } from "@/lib/purchase-order-number";
import { purchaseOrderCategoryFormOptions } from "@/lib/purchase-order-utils";

const inputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";
const labelClassName = "text-xs font-medium text-slate-700";

/** Address and contact, as on Settings, Vendors: label, field name, width. */
const CONTACT_FIELDS = [
  { name: "address", label: "Street address", className: "col-span-6" },
  { name: "city", label: "City", className: "col-span-3" },
  { name: "state", label: "State", className: "col-span-1" },
  { name: "zip", label: "ZIP", className: "col-span-2" },
  { name: "phone", label: "Phone", className: "col-span-3" },
  { name: "contactName", label: "Contact (Attn:)", className: "col-span-3" },
  { name: "email", label: "Email", className: "col-span-6" },
] as const;

/**
 * Adds a vendor from the purchase order screen, so an order for someone new
 * does not mean a trip to Settings and back. Escape or Cancel closes it with
 * nothing saved.
 */
export function NewVendorDialog({
  onCreated,
  onClose,
}: {
  onCreated: (vendor: CreatedVendor) => void;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createVendorInPlace(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onCreated(result.vendor);
    });
  }

  const letters = name.trim() ? purchaseOrderPrefix(name) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-vendor-title"
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h2 id="new-vendor-title" className="text-sm font-semibold text-slate-900">
          New vendor
        </h2>
        <div className="mt-3 grid grid-cols-6 gap-3">
          <div className="col-span-4">
            <label htmlFor="new-vendor-name" className={labelClassName}>
              Name *
            </label>
            <input
              id="new-vendor-name"
              name="name"
              required
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              className={inputClassName}
            />
          </div>
          <div className="col-span-2">
            <p className={labelClassName}>PO numbers</p>
            <p className="mt-1 px-1 py-2 text-xs tabular-nums text-slate-600">
              {letters ? `${letters}-0001, ${letters}-0002…` : "—"}
            </p>
          </div>
          {CONTACT_FIELDS.map((field) => (
            <div key={field.name} className={field.className}>
              <label htmlFor={`new-vendor-${field.name}`} className={labelClassName}>
                {field.label}
              </label>
              <input
                id={`new-vendor-${field.name}`}
                name={field.name}
                className={inputClassName}
              />
            </div>
          ))}
          <div className="col-span-3">
            <label htmlFor="new-vendor-category" className={labelClassName}>
              Default category
            </label>
            <select
              id="new-vendor-category"
              name="defaultCategory"
              defaultValue=""
              className={inputClassName}
            >
              {purchaseOrderCategoryFormOptions.map((option) => (
                <option key={option.value || "one-off"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-2xs text-slate-500">
          The address and contact print in the Vendor block of the purchase order.
        </p>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Saving…" : "Add Vendor"}
          </Button>
        </div>
      </form>
    </div>
  );
}
