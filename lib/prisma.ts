import { PrismaClient } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function isConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("connection terminated") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("connect timeout") ||
    message.includes("connection closed")
  );
}

function resetPrismaState() {
  const pool = globalForPrisma.pool;
  globalForPrisma.pool = undefined;
  globalForPrisma.prisma = undefined;

  if (pool) {
    void pool.end().catch(() => undefined);
  }
}

function createPool() {
  const pool = new Pool({
    connectionString: resolveDatabaseUrl(process.env.DATABASE_URL),
    // Detail pages fan out 9-12 parallel queries; one server, one app, so
    // this stays far below PostgreSQL's max_connections (100).
    max: 20,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 60_000,
  });

  // An idle client died (e.g. PostgreSQL restarted). pg has already removed
  // it from the pool and opens fresh connections on demand; ending the whole
  // pool here would kill queries other requests have in flight.
  pool.on("error", (error) => {
    console.warn("[db] idle PostgreSQL connection dropped:", error.message);
  });

  return pool;
}

function createPrismaClient() {
  const pool = createPool();
  globalForPrisma.pool = pool;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    // Safety net over Prisma's 5s default: bulk actions (imports, price-list
    // copies, awards) grow with the data and must not roll back half-done
    // work just because the office's catalog got bigger.
    transactionOptions: { maxWait: 10_000, timeout: 60_000 },
  });
}

const REQUIRED_APP_SETTINGS_FIELDS = [
  "companyLogoPath",
  "stockSubmittalsRoot",
  "quoteEmailBodyTemplate",
] as const;

function clientHasAppSettingsFields(client: PrismaClient) {
  const runtimeDataModel = (
    client as unknown as {
      _runtimeDataModel?: {
        models?: Record<string, { fields?: Array<{ name: string }> }>;
      };
    }
  )._runtimeDataModel;

  const appSettingsFields =
    runtimeDataModel?.models?.AppSettings?.fields?.map((field) => field.name) ??
    [];

  if (appSettingsFields.length === 0) {
    return false;
  }

  return REQUIRED_APP_SETTINGS_FIELDS.every((field) =>
    appSettingsFields.includes(field),
  );
}

function isPrismaClientStale(client: PrismaClient) {
  // Models added after initial app bootstrap; recreate client if missing.
  if (
    !("invoice" in client) ||
    !("deliveryTicket" in client) ||
    !("priceList" in client) ||
    !("appSettings" in client) ||
    !("jobFile" in client) ||
    !("user" in client) ||
    !("jobFavorite" in client) ||
    !("customerContactRoleDefault" in client)
  ) {
    return true;
  }

  // Quote revision lineage fields added after initial bootstrap.
  if (
    !("previousLineItemId" in Prisma.QuoteLineItemScalarFieldEnum) ||
    !("originalQuoteId" in Prisma.QuoteScalarFieldEnum)
  ) {
    return true;
  }

  // Existing delegate but missing newly generated AppSettings fields.
  return !clientHasAppSettingsFields(client);
}

function isSchemaValidationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "PrismaClientValidationError" &&
    error.message.includes("Unknown field")
  );
}

function getPrismaClient() {
  // Stale-client detection exists for `next dev` hot reload, where a cached
  // client can outlive a schema change. A production build has one client for
  // its lifetime, so skip the per-access field scans there.
  if (
    process.env.NODE_ENV !== "production" &&
    globalForPrisma.prisma &&
    isPrismaClientStale(globalForPrisma.prisma)
  ) {
    resetPrismaState();
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = getPrismaClient();
}

export async function withDatabaseRetry<T>(
  operation: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  try {
    return await operation(getPrismaClient());
  } catch (error) {
    if (isSchemaValidationError(error)) {
      resetPrismaState();
      return operation(getPrismaClient());
    }

    if (!isConnectionError(error)) {
      throw error;
    }

    // Retry on the same pool: pg discards the broken connection and dials a
    // new one. Resetting the pool would end connections that concurrent
    // requests are still using.
    try {
      return await operation(getPrismaClient());
    } catch (retryError) {
      if (isConnectionError(retryError)) {
        throw new Error(
          "Could not connect to PostgreSQL. Ensure the PostgreSQL service is running and DATABASE_URL in .env is correct, then restart `npm run dev`.",
          { cause: retryError },
        );
      }

      throw retryError;
    }
  }
}
