"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * A client that stayed open across a server deploy asks the new build for
 * code that no longer exists. Detect that and hard-reload once instead of
 * showing the error page (the desktop app commonly stays open for days).
 */
function isStaleDeploymentError(error: Error): boolean {
  return (
    /older or newer deployment|Failed to find Server Action|ChunkLoadError|Loading chunk .* failed|dynamically imported module/i.test(
      error.message,
    ) || error.name === "ChunkLoadError"
  );
}

const RELOAD_MARKER_KEY = "precast-stale-deploy-reload";
const RELOAD_LOOP_WINDOW_MS = 60_000;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);

    if (!isStaleDeploymentError(error)) {
      return;
    }
    // Reload at most once per minute so a genuinely broken build can't spin
    // the client in a reload loop.
    const lastReload = Number(sessionStorage.getItem(RELOAD_MARKER_KEY) ?? 0);
    if (Date.now() - lastReload < RELOAD_LOOP_WINDOW_MS) {
      return;
    }
    sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now()));
    window.location.reload();
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          An unexpected error occurred. Try again, or return to the dashboard.
        </p>
        <div className="mt-5 flex gap-2">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
