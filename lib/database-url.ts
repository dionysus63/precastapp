type PrismaDevPayload = {
  databaseUrl?: string;
  shadowDatabaseUrl?: string;
};

function decodeApiKey(apiKey: string): PrismaDevPayload | null {
  try {
    let decoded: string;
    try {
      decoded = Buffer.from(apiKey, "base64url").toString("utf8");
    } catch {
      decoded = Buffer.from(apiKey, "base64").toString("utf8");
    }

    return JSON.parse(decoded) as PrismaDevPayload;
  } catch {
    return null;
  }
}

function resolvePrismaDevPayload(connectionString: string): PrismaDevPayload | null {
  if (!connectionString.startsWith("prisma+postgres://")) {
    return null;
  }

  try {
    const url = new URL(connectionString);
    const apiKey = url.searchParams.get("api_key");
    if (!apiKey) {
      return null;
    }

    return decodeApiKey(apiKey);
  } catch {
    return null;
  }
}

export function resolveDatabaseUrl(connectionString?: string): string {
  const value = connectionString?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is not set.");
  }

  if (value.startsWith("postgresql://") || value.startsWith("postgres://")) {
    return value;
  }

  const payload = resolvePrismaDevPayload(value);
  if (payload?.databaseUrl) {
    return payload.databaseUrl;
  }

  throw new Error(
    "DATABASE_URL must be postgresql:// or a valid prisma+postgres:// URL from `npx prisma dev`.",
  );
}

export function resolveShadowDatabaseUrl(connectionString?: string): string | undefined {
  const value = connectionString?.trim();
  if (!value) {
    return undefined;
  }

  const payload = resolvePrismaDevPayload(value);
  return payload?.shadowDatabaseUrl;
}
