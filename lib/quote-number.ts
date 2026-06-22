import type { Prisma } from "@/app/generated/prisma/client";

type DbClient = Prisma.TransactionClient | {
  quote: {
    findUnique: (args: {
      where: { quoteNumber: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

export async function generateQuoteNumber(
  client: DbClient,
  jobNumber: string | null,
): Promise<string> {
  const yearSuffix = String(new Date().getFullYear() % 100).padStart(2, "0");
  const base = jobNumber ? `Q-${jobNumber}-R0` : `Q-${yearSuffix}-NEW-R0`;

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
