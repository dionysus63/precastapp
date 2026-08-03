"use client";

import { useTransition, type ReactNode } from "react";
import { reloadAfterAction } from "@/lib/reload-after-action";

/**
 * Form wrapper for server-rendered settings pages: runs the server action,
 * then forces a full reload so the page shows the result. Needed because the
 * Next fork drops in-place RSC refreshes on non-localhost origins (see
 * lib/reload-after-action.ts); plain `<form action={serverAction}>` looks
 * fine on localhost but goes stale on the office LAN.
 */
export function ReloadOnSubmitForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      action={(formData) =>
        startTransition(async () => {
          await action(formData);
          reloadAfterAction();
        })
      }
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
