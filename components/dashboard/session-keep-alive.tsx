"use client";

import { useEffect } from "react";
import { keepSessionAlive } from "@/app/session-actions";

const PING_INTERVAL_MS = 10 * 60 * 1000;
const LAST_PING_KEY = "precastapp:session-ping";

function shouldPing(): boolean {
  try {
    const last = Number(window.localStorage.getItem(LAST_PING_KEY) ?? 0);
    return Date.now() - last >= PING_INTERVAL_MS;
  } catch {
    return true;
  }
}

function recordPing(): void {
  try {
    window.localStorage.setItem(LAST_PING_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: the next page view simply pings again.
  }
}

/**
 * Keeps the 8-hour session sliding while someone is using the app. The
 * session cookie can only be refreshed from a server action, so pages that
 * are only viewed (no saves) never extended it and staff got signed out
 * mid-shift. Pings on page load and when the tab comes back into view, at
 * most every 10 minutes — an idle tab left open still times out.
 */
export function SessionKeepAlive() {
  useEffect(() => {
    function ping() {
      if (document.visibilityState !== "visible" || !shouldPing()) {
        return;
      }
      recordPing();
      void keepSessionAlive().catch(() => {
        // A failed ping is harmless; the next one tries again.
      });
    }

    ping();
    document.addEventListener("visibilitychange", ping);
    return () => document.removeEventListener("visibilitychange", ping);
  }, []);

  return null;
}
