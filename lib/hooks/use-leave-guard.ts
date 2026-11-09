"use client";

import { useEffect, useRef } from "react";

/**
 * Catches in-app link clicks (sidebar, tabs, back pills: all client-side
 * navigations, which `beforeunload` never sees) while a screen has unsaved
 * work, and hands the destination to the caller instead of navigating. The
 * caller shows its own dialog and, if the user still wants to go, navigates
 * itself (see `navigateAfterAction`, which also lifts the unload guard).
 *
 * Only plain left clicks on same-origin links that open in this tab count;
 * modifier clicks, downloads, new tabs, hash and mailto links go through.
 * Pairs with `useUnsavedChangesWarning`, which covers reloads and closing.
 */
export function useLeaveGuard(
  active: boolean,
  onLeaveAttempt: (href: string) => void,
) {
  const handlerRef = useRef(onLeaveAttempt);
  useEffect(() => {
    handlerRef.current = onLeaveAttempt;
  }, [onLeaveAttempt]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) {
        return;
      }
      if (anchor.hasAttribute("download") || anchor.dataset.leaveGuard === "ignore") {
        return;
      }
      if (anchor.target && anchor.target !== "_self") {
        return;
      }
      const rawHref = anchor.getAttribute("href") ?? "";
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        /^(mailto|tel|javascript):/i.test(rawHref)
      ) {
        return;
      }
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) {
        return;
      }
      if (url.href === window.location.href) {
        return;
      }

      // Stop the link (and Next's client router behind it) and ask first.
      event.preventDefault();
      event.stopPropagation();
      handlerRef.current(url.pathname + url.search + url.hash);
    };

    // Capture phase on the document runs before React's root listener, so
    // Next's <Link> never sees the click.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);
}
