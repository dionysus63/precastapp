"use client";

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
 */
export function reloadAfterAction(): void {
  window.location.reload();
}
