"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  findSimilarCustomers,
  type SimilarCustomerMatch,
} from "@/app/customers/actions";
import { customerStatusFormOptions } from "@/components/customers/customer-utils";

export type CustomerFormValues = {
  id?: string;
  name: string;
  status: string;
  primaryContactName: string;
  phone: string;
  email: string;
  address: string;
  town: string;
  state: string;
  zip: string;
  notes: string;
};

type CustomerFormProps = {
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  submitLabel: string;
  defaultValues?: CustomerFormValues;
  enableSimilarNameCheck?: boolean;
};

export const customerInputClassName =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm";

export function CustomerForm({
  action,
  cancelHref,
  submitLabel,
  defaultValues,
  enableSimilarNameCheck = false,
}: CustomerFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [similarMatches, setSimilarMatches] = useState<SimilarCustomerMatch[]>(
    [],
  );
  const [showConfirmPanel, setShowConfirmPanel] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isCheckingSimilar, startSimilarCheck] = useTransition();
  const [isSubmitting, startSubmit] = useTransition();

  useEffect(() => {
    if (!enableSimilarNameCheck) {
      return;
    }

    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setSimilarMatches([]);
      setShowConfirmPanel(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      startSimilarCheck(async () => {
        try {
          const matches = await findSimilarCustomers(trimmed);
          setSimilarMatches(matches);
          setShowConfirmPanel(false);
        } catch {
          setSimilarMatches([]);
        }
      });
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [enableSimilarNameCheck, name]);

  function handleNameChange(value: string) {
    setName(value);
    setShowConfirmPanel(false);
    setSubmitError(null);
  }

  function submitForm(confirmedSimilar: boolean) {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    formData.set("name", name.trim());

    if (confirmedSimilar) {
      formData.set("confirmSimilar", "true");
    }

    startSubmit(async () => {
      setSubmitError(null);
      try {
        await action(formData);
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Unable to save customer. Please try again.",
        );
      }
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!enableSimilarNameCheck) {
      return;
    }

    event.preventDefault();

    if (similarMatches.length > 0 && !showConfirmPanel) {
      setShowConfirmPanel(true);
      return;
    }

    submitForm(showConfirmPanel);
  }

  const nameInputProps = enableSimilarNameCheck
    ? {
        value: name,
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
          handleNameChange(event.target.value),
      }
    : {
        defaultValue: defaultValues?.name ?? "",
      };

  return (
    <form
      ref={formRef}
      action={enableSimilarNameCheck ? undefined : action}
      onSubmit={enableSimilarNameCheck ? handleSubmit : undefined}
      className="space-y-5"
    >
      {defaultValues?.id ? (
        <input type="hidden" name="id" value={defaultValues.id} />
      ) : null}

      <div>
        <label
          htmlFor="name"
          className="block text-xs font-medium text-slate-700"
        >
          Customer Name *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          {...nameInputProps}
          className={customerInputClassName}
        />

        {enableSimilarNameCheck && similarMatches.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <p className="font-medium">
              This name looks similar to an existing customer
            </p>
            <p className="mt-1 text-amber-800">
              Review these records before creating a duplicate.
            </p>
            <ul className="mt-2 space-y-1">
              {similarMatches.map((match) => (
                <li key={match.id}>
                  <Link
                    href={`/customers/${match.id}`}
                    className="font-medium text-amber-900 underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
                  >
                    {match.name}
                  </Link>
                </li>
              ))}
            </ul>
            {isCheckingSimilar ? (
              <p className="mt-2 text-amber-700">Checking for similar names…</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="status"
          className="block text-xs font-medium text-slate-700"
        >
          Status *
        </label>
        <select
          id="status"
          name="status"
          required
          defaultValue={defaultValues?.status ?? "ACTIVE"}
          className={customerInputClassName}
        >
          {customerStatusFormOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="primaryContactName"
          className="block text-xs font-medium text-slate-700"
        >
          Primary Contact Name
        </label>
        <input
          id="primaryContactName"
          name="primaryContactName"
          type="text"
          defaultValue={defaultValues?.primaryContactName ?? ""}
          className={customerInputClassName}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="phone"
            className="block text-xs font-medium text-slate-700"
          >
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaultValues?.phone ?? ""}
            className={customerInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues?.email ?? ""}
            className={customerInputClassName}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="address"
          className="block text-xs font-medium text-slate-700"
        >
          Address
        </label>
        <input
          id="address"
          name="address"
          type="text"
          defaultValue={defaultValues?.address ?? ""}
          className={customerInputClassName}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label
            htmlFor="town"
            className="block text-xs font-medium text-slate-700"
          >
            Town
          </label>
          <input
            id="town"
            name="town"
            type="text"
            defaultValue={defaultValues?.town ?? ""}
            className={customerInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="state"
            className="block text-xs font-medium text-slate-700"
          >
            State
          </label>
          <input
            id="state"
            name="state"
            type="text"
            defaultValue={defaultValues?.state ?? ""}
            className={customerInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="zip"
            className="block text-xs font-medium text-slate-700"
          >
            Zip
          </label>
          <input
            id="zip"
            name="zip"
            type="text"
            defaultValue={defaultValues?.zip ?? ""}
            className={customerInputClassName}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-xs font-medium text-slate-700"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={defaultValues?.notes ?? ""}
          className={customerInputClassName}
        />
      </div>

      {enableSimilarNameCheck && showConfirmPanel ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-medium">Create a new customer anyway?</p>
          <p className="mt-1 text-amber-800">
            A similar customer already exists. Only continue if this is a
            separate account.
          </p>
        </div>
      ) : null}

      {submitError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
          {submitError}
        </div>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
        <Link
          href={cancelHref}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        {enableSimilarNameCheck && showConfirmPanel ? (
          <>
            <button
              type="button"
              onClick={() => setShowConfirmPanel(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={() => submitForm(true)}
              disabled={isSubmitting}
              className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
            >
              {isSubmitting ? "Saving…" : "Create Anyway"}
            </button>
          </>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}
