import { execSync } from "child_process";
import { assertIsTestDatabaseUrl, getTestDatabaseUrl } from "./test-db";

/**
 * Runs once before the test suite: point Prisma at the scratch database
 * (created on first run) and bring it to the current migration state.
 */
export default function globalSetup() {
  const url = getTestDatabaseUrl();
  assertIsTestDatabaseUrl(url);

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
