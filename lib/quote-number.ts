import type { Prisma } from "@/app/generated/prisma/client";

type DbClient = Prisma.TransactionClient | {
  quote: {
    findUnique: (args: {
      where: { quoteNumber: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

/** Strip trailing revision suffix (-R0, -R1, -R0-2, etc.) from a quote number. */
export function stripRevisionSuffix(quoteNumber: string): string {
  return quoteNumber.replace(/-R\d+(-\d+)?$/, "");
}

async function findAvailableQuoteNumber(
  client: DbClient,
  base: string,
): Promise<string> {
  let candidate = base;
  let suffix = 2;

  while (
    await client.quote.findUnique({
      where: { quoteNumber: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function generateQuoteNumber(
  client: DbClient,
  jobNumber: string | null,
): Promise<string> {
  const yearSuffix = String(new Date().getFullYear() % 100).padStart(2, "0");
  const base = jobNumber ? `Q-${jobNumber}-R0` : `Q-${yearSuffix}-NEW-R0`;
  return findAvailableQuoteNumber(client, base);
}

/** Generate a quote number for revision N of an existing quote family. */
export async function generateRevisionQuoteNumber(
  client: DbClient,
  sourceQuoteNumber: string,
  revisionNumber: number,
): Promise<string> {
  const base = `${stripRevisionSuffix(sourceQuoteNumber)}-R${revisionNumber}`;
  return findAvailableQuoteNumber(client, base);
}
