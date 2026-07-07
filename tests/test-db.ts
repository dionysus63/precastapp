import { readFileSync } from "fs";
import path from "path";

/**
 * Derive the scratch test database URL from .env's DATABASE_URL by suffixing
 * the database name with `_test`. Tests must never touch the real database.
 */
export function getTestDatabaseUrl(): string {
  const envFile = path.join(__dirname, "..", ".env");
  const line = readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((entry) => /^\s*DATABASE_URL\s*=/.test(entry));
  if (!line) {
    throw new Error("DATABASE_URL not found in .env");
  }

  const url = line.replace(/^\s*DATABASE_URL\s*=\s*/, "").trim().replace(/^"|"$/g, "");
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, "");
  if (!dbName) {
    throw new Error("DATABASE_URL has no database name");
  }

  parsed.pathname = `/${dbName}_test`;
  return parsed.toString();
}

export function assertIsTestDatabaseUrl(url: string): void {
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests against non-test database "${dbName}". ` +
        "Test database names must end with _test.",
    );
  }
}
