"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  navigateAfterAction,
  reloadAfterAction,
} from "@/lib/reload-after-action";

/** What a form's server action reports back instead of throwing. */
export type ActionFormResult = {
  error?: string;
  /** Shown as a toast on the page that loads next. */
  success?: string;
  /** Where to go on success; omitted = reload the current page. */
  redirectTo?: string;
};

/**
 * A form for a server action that returns ActionFormResult. Errors show
 * inline, the way they read: an action that throws only ever shows a
 * generic "something went wrong" page in production. Submitting doesn't
 * reset the inputs (a function `<form action>` does), so a failed save keeps
 * what was typed. Success reloads or navigates — never an in-place refresh,
 * which doesn't apply on the LAN (lib/reload-after-action).
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<ActionFormResult | void>;
  children: ReactNode;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (!result) {
            return;
          }
          if (result.error) {
            setError(result.error);
            return;
          }
          const flash = result.success
            ? { type: "success" as const, text: result.success }
            : undefined;
          if (result.redirectTo) {
            navigateAfterAction(result.redirectTo, flash);
          } else {
            reloadAfterAction(flash);
          }
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
