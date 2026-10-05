/**
 * Server actions report failures by RETURNING `{ error }`, never by throwing:
 * in a production build React replaces a thrown action error's message with
 * a generic "An error occurred", so staff would never see "Ticket is already
 * delivered" or "Duplicate product code". Server side, wrap the body with
 * `returnActionError()` (lib/server/action-errors.ts). Client side, callers
 * either read `result.error`, or wrap the call in `unwrapAction()` to keep an
 * existing try/catch.
 *
 * Safe to import from both server and client modules.
 */
export type ActionError = { error: string };

export function isActionError(value: unknown): value is ActionError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string" &&
    (value as { error: string }).error.length > 0
  );
}

/**
 * Await a server action and rethrow a returned `{ error }` as a local Error,
 * whose message survives (it never crossed the server boundary as a throw):
 *
 *   try {
 *     await unwrapAction(updateJobStatusAction(jobId, status));
 *   } catch (caught) {
 *     setError(caught instanceof Error ? caught.message : "…");
 *   }
 */
export async function unwrapAction<T>(
  pending: Promise<T>,
): Promise<Exclude<T, ActionError>> {
  let result: T;
  try {
    result = await pending;
  } catch (error) {
    if (isStaleDeploymentError(error)) {
      notifyStaleDeployment();
      throw new Error(STALE_DEPLOYMENT_MESSAGE);
    }
    throw error;
  }
  if (isActionError(result)) {
    throw new Error(result.error);
  }
  return result as Exclude<T, ActionError>;
}

// ---------------------------------------------------------------------------
// Pages left open across a server update
// ---------------------------------------------------------------------------

/**
 * Shown when a save fails because the page was loaded from an older build:
 * its server actions no longer exist on the updated server, so nothing on
 * this screen can be saved until the page is reloaded.
 */
export const STALE_DEPLOYMENT_MESSAGE =
  "Precast Ops was updated while this page was open, so it can't save. Reload the page and enter your changes again.";

/** Window event fired when a server action hits a newer deployment. */
export const STALE_DEPLOYMENT_EVENT = "precast:stale-deployment";

/**
 * Next throws `UnrecognizedActionError` ("Server Action … was not found on
 * the server") when the server no longer has the action this page calls.
 */
export function isStaleDeploymentError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === "UnrecognizedActionError" ||
    /Server Action .* was not found on the server|Failed to find Server Action/i.test(
      error.message,
    )
  );
}

export function notifyStaleDeployment(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STALE_DEPLOYMENT_EVENT));
  }
}

/** A caught action failure as text for the screen. */
export function describeActionFailure(
  error: unknown,
  fallback: string,
): string {
  if (isStaleDeploymentError(error)) {
    notifyStaleDeployment();
    return STALE_DEPLOYMENT_MESSAGE;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
