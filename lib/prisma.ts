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
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 60_000,
  });

  pool.on("error", () => {
    resetPrismaState();
  });

  return pool;
}

function createPrismaClient() {
  const pool = createPool();
  globalForPrisma.pool = pool;

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const REQUIRED_APP_SETTINGS_FIELDS = [
  "companyLogoPath",
  "stockSubmittalsRoot",
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
    !("jobFavorite" in client)
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
  for (const field of REQUIRED_APP_SETTINGS_FIELDS) {
    if (!(field in Prisma.AppSettingsScalarFieldEnum)) {
      continue;
    }
  }

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
  if (globalForPrisma.prisma && isPrismaClientStale(globalForPrisma.prisma)) {
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

    resetPrismaState();

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
