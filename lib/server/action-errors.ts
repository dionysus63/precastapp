import { Prisma } from "@/app/generated/prisma/client";

/**
 * Maps known Prisma request errors to messages that are safe and useful to
 * show end users. Unknown codes and non-Prisma errors pass through unchanged.
 */
export function translatePrismaError(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = error.meta?.target;
      const fields = Array.isArray(target)
        ? target.join(", ")
        : typeof target === "string"
          ? target
          : null;
      return new Error(
        fields
          ? `A record with the same ${fields} already exists.`
          : "A record with the same value already exists.",
      );
    }

    if (error.code === "P2025") {
      return new Error(
        "The record was not found — it may have been deleted by another user.",
      );
    }

    if (error.code === "P2003") {
      return new Error(
        "This record is referenced by other records and can't be changed or deleted.",
      );
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

/**
 * Next.js implements redirect() by throwing an error whose digest starts with
 * "NEXT_REDIRECT". Server actions that catch errors must rethrow these so the
 * redirect is not swallowed.
 */
export function isNextRedirectError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

/**
 * Runs a server action body and returns a thrown error as `{ error }`. A
 * message thrown out of a server action never reaches the user in
 * production — React replaces it with a generic "an error occurred" — so
 * validation like "Duplicate product code(s)…" has to come back as data.
 * Next's redirects (e.g. a lost session) still propagate.
 */
export async function returnActionError<T>(
  run: () => Promise<T>,
): Promise<T | { error: string }> {
  try {
    return await run();
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return { error: translatePrismaError(error).message };
  }
}
