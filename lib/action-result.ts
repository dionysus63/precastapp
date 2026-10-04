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
  const result = await pending;
  if (isActionError(result)) {
    throw new Error(result.error);
  }
  return result as Exclude<T, ActionError>;
}
