import { assertIsTestDatabaseUrl, getTestDatabaseUrl } from "./test-db";

// Runs in each worker before any test imports application code: repoint
// DATABASE_URL at the scratch database so `lib/prisma` can never touch the
// real one from inside a test.
const url = getTestDatabaseUrl();
assertIsTestDatabaseUrl(url);
process.env.DATABASE_URL = url;
