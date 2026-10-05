"use client";

import { allowUnload } from "@/lib/unsaved-changes";

/**
 * Reload the page after a successful server-action mutation.
 *
 * The bundled Next fork's client router frequently fails to apply the
 * refreshed RSC payload on non-localhost origins (the office LAN): after a
 * server action revalidates, the new tree suspends forever (React #460 —
 * a flight chunk stays pending) and the page keeps showing stale data until
 * the user navigates away and back. Reproduced 2026-07-22 on prod builds in
 * plain Chrome, a bare Electron window, and the desktop shell; every
 * in-place variant fails there (`router.refresh()`, refresh in its own
 * transition, server-side `refresh()` from next/cache, same-URL
 * `router.replace()`, `redirect()` back to the same page, Next 16.2.11).
 * Only full navigations and action return values survive.
 *
 * So: surfaces whose server-rendered content must change after a mutation
 * call this instead of `router.refresh()`. A reload on the LAN takes a few
 * hundred milliseconds and is always correct. Panels that can render the
 * action's returned data directly (e.g. the customer contacts panel) should
 * keep doing that — it is instant and equally reliable.
 *
 * Pass `flash` to show a message on the reloaded page (a toast, via
 * AppProviders) — otherwise a success note or warning set just before the
 * reload disappears before anyone can read it.
 */
export function reloadAfterAction(flash?: FlashMessage): void {
  storeFlashMessage(flash);
  // The work was just saved: don't let a screen's "unsaved changes" guard
  // block the page load. The desktop shell cancels a guarded unload
  // silently, which left editors sitting there after a successful save.
  allowUnload();
  window.location.reload();
}

/**
 * Go to another page after a mutation, as a full navigation. Same reason as
 * reloadAfterAction: `router.push()` + `router.refresh()` can render the
 * destination from a stale client cache on the LAN.
 */
export function navigateAfterAction(href: string, flash?: FlashMessage): void {
  storeFlashMessage(flash);
  allowUnload(); // see reloadAfterAction
  window.location.assign(href);
}

export type FlashMessage = {
  type: "success" | "info" | "warning" | "error";
  text: string;
};

const FLASH_STORAGE_KEY = "precastapp:flash";

function storeFlashMessage(flash: FlashMessage | undefined): void {
  if (!flash?.text) {
    return;
  }
  try {
    window.sessionStorage.setItem(FLASH_STORAGE_KEY, JSON.stringify(flash));
  } catch {
    // Storage unavailable (private mode, quota): the action still succeeded.
  }
}

/** Read and clear the message stored by the last reload/navigation, if any. */
export function takeFlashMessage(): FlashMessage | null {
  try {
    const raw = window.sessionStorage.getItem(FLASH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    window.sessionStorage.removeItem(FLASH_STORAGE_KEY);
    const parsed = JSON.parse(raw) as Partial<FlashMessage>;
    if (typeof parsed.text !== "string" || !parsed.text) {
      return null;
    }
    const type =
      parsed.type === "info" || parsed.type === "warning" || parsed.type === "error"
        ? parsed.type
        : "success";
    return { type, text: parsed.text };
  } catch {
    return null;
  }
}
