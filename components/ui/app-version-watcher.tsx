"use client";

import { useEffect, useRef, useState } from "react";
import { ACTION_NOT_FOUND_HEADER, versionCheckStep } from "@/lib/app-version";
import {
  STALE_DEPLOYMENT_EVENT,
  isStaleDeploymentError,
} from "@/lib/action-result";
import { allowUnload, hasUnsavedChanges } from "@/lib/unsaved-changes";

const CHECK_INTERVAL_MS = 5 * 60_000;
const FOCUS_MIN_GAP_MS = 60_000;

/**
 * A page left open across a server update keeps the old build's JavaScript,
 * whose server actions no longer exist on the new server — saves then fail
 * (before, silently). This watches the server's build id and, once it
 * changes, reloads the page when nothing is unsaved, or shows a banner asking
 * the user to reload. A save that hits a missing action shows the banner too.
 *
 * The desktop shell has its own build-id watcher, but its reload is silently
 * cancelled on screens with a leave-page guard (unsaved edits), and plain
 * browser tabs have no watcher at all.
 */
export function AppVersionWatcher() {
  const [outdated, setOutdated] = useState(false);
  const baselineRef = useRef<string | null>(null);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    let disposed = false;

    async function check() {
      lastCheckRef.current = Date.now();
      let current: string | null = null;
      try {
        const response = await fetch("/api/build-id", { cache: "no-store" });
        if (response.ok) {
          current = (await response.text()).trim() || null;
        }
      } catch {
        return; // Offline or server restarting — try again later.
      }
      if (disposed || !current) {
        return;
      }
      if (baselineRef.current === null) {
        baselineRef.current = current;
        return;
      }
      const step = versionCheckStep(
        baselineRef.current,
        current,
        hasUnsavedChanges(),
      );
      if (step === "reload") {
        window.location.reload();
      } else if (step === "warn") {
        setOutdated(true);
      }
    }

    function onFocus() {
      if (Date.now() - lastCheckRef.current >= FOCUS_MIN_GAP_MS) {
        void check();
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        onFocus();
      }
    }
    function onStaleAction() {
      setOutdated(true);
    }
    function onRejection(event: PromiseRejectionEvent) {
      if (isStaleDeploymentError(event.reason)) {
        setOutdated(true);
      }
    }

    // Any server-action response saying "not found" means this page is from
    // an older build, whichever screen made the call and however it handles
    // the error.
    const originalFetch = window.fetch;
    const watchedFetch: typeof window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.headers.get(ACTION_NOT_FOUND_HEADER) === "1") {
        setOutdated(true);
      }
      return response;
    };
    window.fetch = watchedFetch;

    void check();
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(STALE_DEPLOYMENT_EVENT, onStaleAction);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(STALE_DEPLOYMENT_EVENT, onStaleAction);
      window.removeEventListener("unhandledrejection", onRejection);
      if (window.fetch === watchedFetch) {
        window.fetch = originalFetch;
      }
    };
  }, []);

  if (!outdated) {
    return null;
  }

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center justify-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 shadow-md"
    >
      <span>
        <strong className="font-semibold">Precast Ops was updated.</strong>{" "}
        Reload to keep working — this page can&apos;t save until you do.
        {hasUnsavedChanges()
          ? " Anything not yet saved on this screen will need to be entered again."
          : ""}
      </span>
      <button
        type="button"
        onClick={() => {
          allowUnload();
          window.location.reload();
        }}
        className="rounded-md bg-amber-900 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800"
      >
        Reload page
      </button>
    </div>
  );
}
