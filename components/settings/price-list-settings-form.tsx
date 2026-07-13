"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updatePriceListSettings } from "@/app/settings/actions";
import { SettingsFeedback } from "@/components/settings/settings-form-fields";

type PriceListSettingsFormProps = {
  priceList: {
    id: string;
    name: string;
    /** YYYY-MM-DD or empty. */
    effectiveDate: string;
    isDefault: boolean;
    /** Default F.O.B. wording for quotes on this list; blank means Factory. */
    fobDefault: string;
    notes: string;
  };
};

export function PriceListSettingsForm({ priceList }: PriceListSettingsFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setMessage({});
    startTransition(async () => {
      try {
        const result = await updatePriceListSettings(formData);
        setMessage(result);
        if (result.success) {
          router.refresh();
        }
      } catch {
        setMessage({ error: "An unexpected error occurred. Please try again." });
      }
    });
  }

  return (
    <form action={handleSubmit} className="grid max-w-lg gap-3">
      <input type="hidden" name="id" value={priceList.id} />
      <div>
        <label
          htmlFor="price-list-name"
          className="text-xs font-medium text-slate-700"
        >
          Name
        </label>
        <input
          id="price-list-name"
          name="name"
          required
          defaultValue={priceList.name}
          className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
        />
      </div>
      <div>
        <label
          htmlFor="price-list-effective-date"
          className="text-xs font-medium text-slate-700"
        >
          Effective date
        </label>
        <input
          id="price-list-effective-date"
          name="effectiveDate"
          type="date"
          defaultValue={priceList.effectiveDate}
          className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
        />
      </div>
      <div>
        <label
          htmlFor="price-list-fob"
          className="text-xs font-medium text-slate-700"
        >
          F.O.B. default
        </label>
        <input
          id="price-list-fob"
          name="fobDefault"
          defaultValue={priceList.fobDefault}
          placeholder="Factory"
          className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          New quotes on this list start with this F.O.B. (blank = Factory).
          Editable per quote.
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={priceList.isDefault}
          disabled={priceList.isDefault}
        />
        Default price list
      </label>
      {priceList.isDefault ? (
        <p className="text-[11px] text-slate-500">
          This is the current default. Make another list the default to
          replace it.
        </p>
      ) : (
        <p className="text-[11px] text-slate-500">
          A list must price every active product before it can become the
          default.
        </p>
      )}
      <div>
        <label
          htmlFor="price-list-notes"
          className="text-xs font-medium text-slate-700"
        >
          Notes
        </label>
        <input
          id="price-list-notes"
          name="notes"
          defaultValue={priceList.notes}
          className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        <SettingsFeedback error={message.error} success={message.success} />
      </div>
    </form>
  );
}
