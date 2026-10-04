"use server";

import { getCurrentUser } from "@/lib/auth/session";

/**
 * Slides the session's 8-hour expiry (cookie + database). Reading the
 * current user does it — but only in a server action, where the cookie may
 * be rewritten (see slideSessionIfNeeded). Called by SessionKeepAlive.
 */
export async function keepSessionAlive(): Promise<void> {
  await getCurrentUser();
}
